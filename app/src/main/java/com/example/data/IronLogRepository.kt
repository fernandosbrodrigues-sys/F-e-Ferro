package com.example.data

import android.content.Context
import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import java.util.UUID

class IronLogRepository(context: Context) {
    private val db = IronLogDatabase.getInstance(context)
    private val userDao = db.userDao()
    private val sessionDao = db.userSessionDao()
    private val workoutDao = db.workoutDao()
    private val trainingDao = db.trainingDao()
    private val weightDao = db.weightLogDao()

    private val authPrefs = context.getSharedPreferences("ironlog_auth", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SESSION_TOKEN = "session_token"
    }

    fun observeAdminCount(): Flow<Int> = userDao.observeAdminCount()
    fun observeUser(userId: String): Flow<UserEntity?> = userDao.observeById(userId)
    fun observeWorkouts(userId: String): Flow<List<WorkoutEntity>> = workoutDao.observeByUser(userId)
    fun observeExercises(userId: String): Flow<List<ExerciseEntity>> = workoutDao.observeExercisesByUser(userId)
    fun observeSessions(userId: String): Flow<List<WorkoutSessionEntity>> = trainingDao.observeSessionsByUser(userId)
    fun observeSessionExercises(userId: String): Flow<List<SessionExerciseEntity>> = trainingDao.observeSessionExercisesByUser(userId)
    fun observeSetLogs(userId: String): Flow<List<SetLogEntity>> = trainingDao.observeSetLogsByUser(userId)
    fun observeWeightLogs(userId: String): Flow<List<WeightLogEntity>> = weightDao.observeByUser(userId)

    suspend fun hasAdmin(): Boolean = userDao.countAdmins() > 0

    suspend fun restoreSession(): UserEntity? {
        val token = authPrefs.getString(KEY_SESSION_TOKEN, null) ?: return null
        val sess = sessionDao.findByToken(token) ?: run {
            authPrefs.edit().remove(KEY_SESSION_TOKEN).apply()
            return null
        }
        val user = userDao.findById(sess.userId)
        if (user == null || user.isBlocked) {
            sessionDao.deleteByToken(token)
            authPrefs.edit().remove(KEY_SESSION_TOKEN).apply()
            return null
        }
        return user
    }

    suspend fun claimInitialAdmin(rawUsername: String, password: String, confirmPassword: String): Result<UserEntity> {
        val username = SecurityUtils.normalizeUsername(rawUsername)
        if (!SecurityUtils.isValidEmail(username)) {
            return Result.failure(IllegalArgumentException("Informe um e-mail válido (ex: nome@sobrenome.com)."))
        }
        if (password.length < 6) {
            return Result.failure(IllegalArgumentException("A senha deve ter no mínimo 6 caracteres."))
        }
        if (password != confirmPassword) {
            return Result.failure(IllegalArgumentException("As senhas não coincidem."))
        }

        return db.withTransaction {
            if (userDao.countAdmins() > 0) {
                return@withTransaction Result.failure(IllegalStateException("A conta ADMIN inicial já foi configurada."))
            }
            if (userDao.findByUsername(username) != null) {
                return@withTransaction Result.failure(IllegalArgumentException("Este e-mail já está em uso."))
            }
            val user = UserEntity(
                id = UUID.randomUUID().toString(),
                username = username,
                passwordHash = SecurityUtils.hashPassword(password),
                role = UserRole.ADMIN.name,
                isBlocked = false,
                createdAt = System.currentTimeMillis()
            )
            userDao.insert(user)
            seedWorkoutsForUser(user.id)
            createSessionForUser(user.id)
            Result.success(user)
        }
    }

    suspend fun registerStudent(rawUsername: String, password: String, confirmPassword: String): Result<UserEntity> {
        val username = SecurityUtils.normalizeUsername(rawUsername)
        if (!SecurityUtils.isValidEmail(username)) {
            return Result.failure(IllegalArgumentException("Informe um e-mail válido (ex: nome@sobrenome.com)."))
        }
        if (password.length < 6) {
            return Result.failure(IllegalArgumentException("A senha deve ter no mínimo 6 caracteres."))
        }
        if (password != confirmPassword) {
            return Result.failure(IllegalArgumentException("As senhas não coincidem."))
        }

        return db.withTransaction {
            if (userDao.findByUsername(username) != null) {
                return@withTransaction Result.failure(IllegalArgumentException("Este e-mail já está em uso."))
            }
            val user = UserEntity(
                id = UUID.randomUUID().toString(),
                username = username,
                passwordHash = SecurityUtils.hashPassword(password),
                role = UserRole.ALUNO.name,
                isBlocked = false,
                createdAt = System.currentTimeMillis()
            )
            userDao.insert(user)
            seedWorkoutsForUser(user.id)
            createSessionForUser(user.id)
            Result.success(user)
        }
    }

    suspend fun login(rawUsername: String, password: String): Result<UserEntity> {
        val username = SecurityUtils.normalizeUsername(rawUsername)
        if (!SecurityUtils.isValidLoginIdentifier(username) || password.isEmpty()) {
            return Result.failure(IllegalArgumentException("Informe um e-mail e senha válidos."))
        }
        val user = userDao.findByUsername(username)
            ?: return Result.failure(IllegalArgumentException("E-mail ou senha incorretos."))

        if (!SecurityUtils.verifyPassword(password, user.passwordHash)) {
            return Result.failure(IllegalArgumentException("E-mail ou senha incorretos."))
        }
        if (user.isBlocked) {
            return Result.failure(IllegalStateException("Conta bloqueada. Contate o administrador."))
        }

        createSessionForUser(user.id)
        return Result.success(user)
    }

    suspend fun logout() {
        val token = authPrefs.getString(KEY_SESSION_TOKEN, null)
        if (token != null) {
            sessionDao.deleteByToken(token)
            authPrefs.edit().remove(KEY_SESSION_TOKEN).apply()
        }
    }

    private suspend fun createSessionForUser(userId: String) {
        val token = SecurityUtils.generateSessionToken()
        sessionDao.insert(
            UserSessionEntity(
                token = token,
                userId = userId,
                createdAt = System.currentTimeMillis()
            )
        )
        authPrefs.edit().putString(KEY_SESSION_TOKEN, token).apply()
    }

    private suspend fun seedWorkoutsForUser(userId: String) {
        val (workouts, exercises) = WorkoutSeed.buildForUser(userId)
        workoutDao.insertWorkouts(workouts)
        workoutDao.insertExercises(exercises)
    }

    // =========================================================================
    // ADMIN OPERATIONS (validadas no backend/repositório)
    // =========================================================================
    private suspend fun requireAdmin(callerId: String): UserEntity {
        val caller = userDao.findById(callerId)
            ?: throw SecurityException("Usuário não autenticado.")
        if (caller.role != UserRole.ADMIN.name || caller.isBlocked) {
            throw SecurityException("Acesso restrito ao administrador.")
        }
        return caller
    }

    suspend fun listUsersAsAdmin(callerId: String): Result<List<UserEntity>> = runCatching {
        requireAdmin(callerId)
        userDao.listAll()
    }

    suspend fun createUserAsAdmin(
        callerId: String,
        rawUsername: String,
        password: String,
        role: UserRole
    ): Result<UserEntity> = runCatching {
        requireAdmin(callerId)
        val username = SecurityUtils.normalizeUsername(rawUsername)
        require(SecurityUtils.isValidEmail(username)) {
            "Informe um e-mail válido (ex: nome@sobrenome.com)."
        }
        require(password.length >= 6) {
            "A senha deve ter no mínimo 6 caracteres."
        }
        db.withTransaction {
            if (userDao.findByUsername(username) != null) {
                throw IllegalArgumentException("Este e-mail já está em uso.")
            }
            val user = UserEntity(
                id = UUID.randomUUID().toString(),
                username = username,
                passwordHash = SecurityUtils.hashPassword(password),
                role = role.name,
                isBlocked = false,
                createdAt = System.currentTimeMillis()
            )
            userDao.insert(user)
            seedWorkoutsForUser(user.id)
            user
        }
    }

    suspend fun setUserBlockedAsAdmin(callerId: String, targetUserId: String, blocked: Boolean): Result<Unit> = runCatching {
        requireAdmin(callerId)
        require(targetUserId != callerId) { "Operação não permitida para a própria conta." }
        userDao.updateBlocked(targetUserId, blocked)
        if (blocked) {
            sessionDao.deleteByUserId(targetUserId)
        }
    }

    suspend fun resetPasswordAsAdmin(
        callerId: String,
        targetUserId: String,
        newPassword: String,
        confirmPassword: String
    ): Result<Unit> = runCatching {
        requireAdmin(callerId)
        require(newPassword.length >= 6) { "Senha deve ter no mínimo 6 caracteres." }
        require(newPassword == confirmPassword) { "As senhas não coincidem." }
        userDao.updatePasswordHash(targetUserId, SecurityUtils.hashPassword(newPassword))
    }

    suspend fun deleteUserAsAdmin(callerId: String, targetUserId: String): Result<Unit> = runCatching {
        requireAdmin(callerId)
        require(targetUserId != callerId) { "Não é possível excluir a própria conta." }
        userDao.deleteById(targetUserId)
    }

    // =========================================================================
    // TREINOS, SÉRIES, SUBSTITUIÇÃO E HISTÓRICO (isolados por userId)
    // =========================================================================
    suspend fun updateWorkoutSchedule(userId: String, assignments: List<Pair<String, Int>>): Result<Unit> = runCatching {
        db.withTransaction {
            val userWorkouts = workoutDao.listByUser(userId)
            val byId = userWorkouts.associateBy { it.id }
            require(assignments.size == userWorkouts.size) {
                "Atribua todos os ${userWorkouts.size} treinos da ficha."
            }
            val seenDays = mutableSetOf<Int>()
            assignments.forEach { (workoutId, dayOfWeek) ->
                val wk = byId[workoutId]
                    ?: throw IllegalArgumentException("Treino não encontrado.")
                require(dayOfWeek in 1..7) { "Dia da semana inválido." }
                require(seenDays.add(dayOfWeek)) { "Não pode haver dois treinos no mesmo dia." }
                workoutDao.updateSchedule(
                    workoutId = wk.id,
                    userId = userId,
                    dayOfWeek = dayOfWeek,
                    name = WorkoutSeed.formatWorkoutNameForDay(dayOfWeek, wk.code),
                    sortOrder = dayOfWeek
                )
            }
        }
    }

    suspend fun startWorkout(userId: String, workoutId: String): Result<String> = runCatching {
        db.withTransaction {
            val existing = trainingDao.getActiveSession(userId)
            if (existing != null) return@withTransaction existing.id

            val workout = workoutDao.findById(workoutId, userId)
                ?: throw IllegalArgumentException("Treino não encontrado.")
            val workoutExercises = workoutDao.getExercisesForWorkout(workoutId, userId)

            val now = System.currentTimeMillis()
            val sessionId = UUID.randomUUID().toString()
            trainingDao.insertSession(
                WorkoutSessionEntity(
                    id = sessionId,
                    userId = userId,
                    workoutId = workout.id,
                    workoutName = workout.name,
                    startedAt = now,
                    completedAt = null,
                    status = "in_progress",
                    totalVolumeKg = 0.0
                )
            )

            val sessionExercises = mutableListOf<SessionExerciseEntity>()
            val setLogs = mutableListOf<SetLogEntity>()

            workoutExercises.forEach { ex ->
                val seId = UUID.randomUUID().toString()
                sessionExercises += SessionExerciseEntity(
                    id = seId,
                    userId = userId,
                    sessionId = sessionId,
                    workoutExerciseId = ex.id,
                    originalExerciseKey = ex.exerciseKey,
                    originalExerciseName = ex.name,
                    performedExerciseKey = ex.exerciseKey,
                    performedExerciseName = ex.name,
                    targetSets = ex.targetSets,
                    repMin = ex.repMin,
                    repMax = ex.repMax,
                    defaultRestSec = ex.defaultRestSec,
                    alternativesJson = ex.alternativesJson,
                    sortOrder = ex.sortOrder
                )

                for (setNum in 1..ex.targetSets) {
                    setLogs += SetLogEntity(
                        id = UUID.randomUUID().toString(),
                        userId = userId,
                        sessionId = sessionId,
                        sessionExerciseId = seId,
                        exerciseKey = ex.exerciseKey,
                        exerciseName = ex.name,
                        setNumber = setNum,
                        weightKg = null,
                        reps = null,
                        rir = null,
                        plannedRestSec = ex.defaultRestSec,
                        actualRestSec = null,
                        completed = false,
                        completedAt = null,
                        createdAt = now + setNum
                    )
                }
            }

            trainingDao.insertSessionExercises(sessionExercises)
            trainingDao.insertSetLogs(setLogs)
            sessionId
        }
    }

    suspend fun updateSetField(
        userId: String,
        setId: String,
        weightKg: Double?,
        reps: Int?,
        rir: Int?,
        plannedRestSec: Int
    ) {
        val current = trainingDao.getSetLog(setId, userId) ?: return
        val clampedRir = rir?.coerceIn(0, 5)
        val clampedRest = plannedRestSec.coerceIn(10, 600)
        val clampedWeight = weightKg?.coerceAtLeast(0.0)
        val clampedReps = reps?.coerceAtLeast(0)

        trainingDao.updateSetValues(
            setId = setId,
            userId = userId,
            weightKg = clampedWeight,
            reps = clampedReps,
            rir = clampedRir,
            plannedRestSec = clampedRest
        )
        recalculateSessionVolumeIfCompleted(userId, current.sessionId)
    }

    suspend fun toggleSetCompleted(userId: String, setId: String): SetLogEntity? {
        val current = trainingDao.getSetLog(setId, userId) ?: return null
        val nextDone = !current.completed
        val completedAt = if (nextDone) System.currentTimeMillis() else null
        trainingDao.updateSetCompleted(setId, userId, nextDone, completedAt)
        recalculateSessionVolumeIfCompleted(userId, current.sessionId)
        return current.copy(completed = nextDone, completedAt = completedAt)
    }

    suspend fun addSet(userId: String, sessionExerciseId: String) {
        val se = trainingDao.getSessionExercise(sessionExerciseId, userId) ?: return
        val existingSets = trainingDao.getSetLogsForSessionExercise(sessionExerciseId, userId)
        val nextNum = (existingSets.maxOfOrNull { it.setNumber } ?: 0) + 1
        trainingDao.insertSetLog(
            SetLogEntity(
                id = UUID.randomUUID().toString(),
                userId = userId,
                sessionId = se.sessionId,
                sessionExerciseId = se.id,
                exerciseKey = se.performedExerciseKey,
                exerciseName = se.performedExerciseName,
                setNumber = nextNum,
                weightKg = null,
                reps = null,
                rir = null,
                plannedRestSec = se.defaultRestSec,
                actualRestSec = null,
                completed = false,
                completedAt = null,
                createdAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun deleteSet(userId: String, setId: String) {
        val current = trainingDao.getSetLog(setId, userId) ?: return
        trainingDao.deleteSetLog(setId, userId)
        recalculateSessionVolumeIfCompleted(userId, current.sessionId)
    }

    suspend fun substituteExercise(userId: String, sessionExerciseId: String, chosen: AlternativeOption) {
        db.withTransaction {
            val se = trainingDao.getSessionExercise(sessionExerciseId, userId) ?: return@withTransaction
            val restSec = chosen.defaultRestSec.coerceIn(10, 600)
            trainingDao.updatePerformedExercise(
                id = se.id,
                userId = userId,
                newKey = chosen.key,
                newName = chosen.name,
                newRestSec = restSec
            )
            // Atualiza apenas séries ainda não concluídas para não misturar cargas já registradas
            trainingDao.updatePendingSetsExercise(
                sessionExerciseId = se.id,
                userId = userId,
                newKey = chosen.key,
                newName = chosen.name,
                newRestSec = restSec
            )
        }
    }

    suspend fun editHistoricalExerciseVariation(
        userId: String,
        sessionExerciseId: String,
        chosen: AlternativeOption
    ) {
        db.withTransaction {
            val se = trainingDao.getSessionExercise(sessionExerciseId, userId) ?: return@withTransaction
            trainingDao.updatePerformedExercise(
                id = se.id,
                userId = userId,
                newKey = chosen.key,
                newName = chosen.name,
                newRestSec = se.defaultRestSec
            )
            trainingDao.updateAllSetsExerciseForSessionExercise(
                sessionExerciseId = se.id,
                userId = userId,
                newKey = chosen.key,
                newName = chosen.name
            )
        }
    }

    suspend fun recordActualRest(userId: String, setId: String, actualRestSec: Int) {
        trainingDao.updateActualRest(setId, userId, actualRestSec.coerceAtLeast(0))
    }

    suspend fun finishSession(userId: String, sessionId: String) {
        val sets = trainingDao.getSetLogsForSession(sessionId, userId)
        val totalVol = sets.filter { it.completed }
            .sumOf { (it.weightKg ?: 0.0) * (it.reps ?: 0) }
        trainingDao.completeSession(
            sessionId = sessionId,
            userId = userId,
            completedAt = System.currentTimeMillis(),
            totalVolumeKg = totalVol
        )
    }

    suspend fun discardSession(userId: String, sessionId: String) {
        trainingDao.deleteSession(sessionId, userId)
    }

    private suspend fun recalculateSessionVolumeIfCompleted(userId: String, sessionId: String) {
        val session = trainingDao.getSession(sessionId, userId) ?: return
        if (session.status == "completed") {
            val sets = trainingDao.getSetLogsForSession(sessionId, userId)
            val totalVol = sets.filter { it.completed }
                .sumOf { (it.weightKg ?: 0.0) * (it.reps ?: 0) }
            trainingDao.updateTotalVolume(sessionId, userId, totalVol)
        }
    }

    // =========================================================================
    // PESO CORPORAL
    // =========================================================================
    suspend fun logBodyWeight(userId: String, weightKg: Double) {
        if (weightKg <= 0.0) return
        val now = System.currentTimeMillis()
        weightDao.insert(
            WeightLogEntity(
                id = UUID.randomUUID().toString(),
                userId = userId,
                weightKg = weightKg,
                recordedAt = now,
                createdAt = now
            )
        )
    }

    suspend fun deleteBodyWeight(userId: String, weightId: String) {
        weightDao.deleteById(weightId, userId)
    }
}
