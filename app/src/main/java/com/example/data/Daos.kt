package com.example.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface UserDao {
    @Query("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'")
    suspend fun countAdmins(): Int

    @Query("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'")
    fun observeAdminCount(): Flow<Int>

    @Query("SELECT * FROM users WHERE username = :username LIMIT 1")
    suspend fun findByUsername(username: String): UserEntity?

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): UserEntity?

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    fun observeById(id: String): Flow<UserEntity?>

    @Query("SELECT * FROM users ORDER BY createdAt DESC")
    suspend fun listAll(): List<UserEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(user: UserEntity)

    @Query("UPDATE users SET isBlocked = :blocked WHERE id = :userId")
    suspend fun updateBlocked(userId: String, blocked: Boolean)

    @Query("UPDATE users SET passwordHash = :passwordHash WHERE id = :userId")
    suspend fun updatePasswordHash(userId: String, passwordHash: String)

    @Query("DELETE FROM users WHERE id = :userId")
    suspend fun deleteById(userId: String)
}

@Dao
interface UserSessionDao {
    @Query("SELECT * FROM user_sessions WHERE token = :token LIMIT 1")
    suspend fun findByToken(token: String): UserSessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(session: UserSessionEntity)

    @Query("DELETE FROM user_sessions WHERE token = :token")
    suspend fun deleteByToken(token: String)

    @Query("DELETE FROM user_sessions WHERE userId = :userId")
    suspend fun deleteByUserId(userId: String)
}

@Dao
interface WorkoutDao {
    @Query("SELECT * FROM workouts WHERE userId = :userId ORDER BY sortOrder ASC")
    fun observeByUser(userId: String): Flow<List<WorkoutEntity>>

    @Query("SELECT * FROM workouts WHERE userId = :userId ORDER BY sortOrder ASC")
    suspend fun listByUser(userId: String): List<WorkoutEntity>

    @Query("SELECT * FROM workouts WHERE id = :workoutId AND userId = :userId LIMIT 1")
    suspend fun findById(workoutId: String, userId: String): WorkoutEntity?

    @Query("UPDATE workouts SET dayOfWeek = :dayOfWeek, name = :name, sortOrder = :sortOrder WHERE id = :workoutId AND userId = :userId")
    suspend fun updateSchedule(workoutId: String, userId: String, dayOfWeek: Int, name: String, sortOrder: Int)

    @Query("SELECT * FROM exercises WHERE userId = :userId ORDER BY sortOrder ASC")
    fun observeExercisesByUser(userId: String): Flow<List<ExerciseEntity>>

    @Query("SELECT * FROM exercises WHERE workoutId = :workoutId AND userId = :userId ORDER BY sortOrder ASC")
    suspend fun getExercisesForWorkout(workoutId: String, userId: String): List<ExerciseEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertWorkouts(workouts: List<WorkoutEntity>)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertExercises(exercises: List<ExerciseEntity>)
}

@Dao
interface TrainingDao {
    @Query("SELECT * FROM workout_sessions WHERE userId = :userId ORDER BY startedAt DESC")
    fun observeSessionsByUser(userId: String): Flow<List<WorkoutSessionEntity>>

    @Query("SELECT * FROM workout_sessions WHERE id = :sessionId AND userId = :userId LIMIT 1")
    suspend fun getSession(sessionId: String, userId: String): WorkoutSessionEntity?

    @Query("SELECT * FROM workout_sessions WHERE userId = :userId AND status = 'in_progress' ORDER BY startedAt DESC LIMIT 1")
    suspend fun getActiveSession(userId: String): WorkoutSessionEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSession(session: WorkoutSessionEntity)

    @Query("UPDATE workout_sessions SET status = 'completed', completedAt = :completedAt, totalVolumeKg = :totalVolumeKg WHERE id = :sessionId AND userId = :userId")
    suspend fun completeSession(sessionId: String, userId: String, completedAt: Long, totalVolumeKg: Double)

    @Query("UPDATE workout_sessions SET totalVolumeKg = :totalVolumeKg WHERE id = :sessionId AND userId = :userId")
    suspend fun updateTotalVolume(sessionId: String, userId: String, totalVolumeKg: Double)

    @Query("DELETE FROM workout_sessions WHERE id = :sessionId AND userId = :userId")
    suspend fun deleteSession(sessionId: String, userId: String)

    @Query("SELECT * FROM session_exercises WHERE userId = :userId ORDER BY sortOrder ASC")
    fun observeSessionExercisesByUser(userId: String): Flow<List<SessionExerciseEntity>>

    @Query("SELECT * FROM session_exercises WHERE sessionId = :sessionId AND userId = :userId ORDER BY sortOrder ASC")
    suspend fun getSessionExercises(sessionId: String, userId: String): List<SessionExerciseEntity>

    @Query("SELECT * FROM session_exercises WHERE id = :id AND userId = :userId LIMIT 1")
    suspend fun getSessionExercise(id: String, userId: String): SessionExerciseEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSessionExercises(items: List<SessionExerciseEntity>)

    @Query("UPDATE session_exercises SET performedExerciseKey = :newKey, performedExerciseName = :newName, defaultRestSec = :newRestSec WHERE id = :id AND userId = :userId")
    suspend fun updatePerformedExercise(id: String, userId: String, newKey: String, newName: String, newRestSec: Int)

    @Query("SELECT * FROM set_logs WHERE userId = :userId ORDER BY createdAt ASC, setNumber ASC")
    fun observeSetLogsByUser(userId: String): Flow<List<SetLogEntity>>

    @Query("SELECT * FROM set_logs WHERE sessionId = :sessionId AND userId = :userId ORDER BY setNumber ASC")
    suspend fun getSetLogsForSession(sessionId: String, userId: String): List<SetLogEntity>

    @Query("SELECT * FROM set_logs WHERE sessionExerciseId = :sessionExerciseId AND userId = :userId ORDER BY setNumber ASC")
    suspend fun getSetLogsForSessionExercise(sessionExerciseId: String, userId: String): List<SetLogEntity>

    @Query("SELECT * FROM set_logs WHERE id = :setId AND userId = :userId LIMIT 1")
    suspend fun getSetLog(setId: String, userId: String): SetLogEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSetLogs(sets: List<SetLogEntity>)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSetLog(set: SetLogEntity)

    @Query("UPDATE set_logs SET weightKg = :weightKg, reps = :reps, rir = :rir, plannedRestSec = :plannedRestSec WHERE id = :setId AND userId = :userId")
    suspend fun updateSetValues(setId: String, userId: String, weightKg: Double?, reps: Int?, rir: Int?, plannedRestSec: Int)

    @Query("UPDATE set_logs SET completed = :completed, completedAt = :completedAt WHERE id = :setId AND userId = :userId")
    suspend fun updateSetCompleted(setId: String, userId: String, completed: Boolean, completedAt: Long?)

    @Query("UPDATE set_logs SET actualRestSec = :actualRestSec WHERE id = :setId AND userId = :userId")
    suspend fun updateActualRest(setId: String, userId: String, actualRestSec: Int)

    @Query("UPDATE set_logs SET exerciseKey = :newKey, exerciseName = :newName, plannedRestSec = :newRestSec WHERE sessionExerciseId = :sessionExerciseId AND userId = :userId AND completed = 0")
    suspend fun updatePendingSetsExercise(sessionExerciseId: String, userId: String, newKey: String, newName: String, newRestSec: Int)

    @Query("UPDATE set_logs SET exerciseKey = :newKey, exerciseName = :newName WHERE sessionExerciseId = :sessionExerciseId AND userId = :userId")
    suspend fun updateAllSetsExerciseForSessionExercise(sessionExerciseId: String, userId: String, newKey: String, newName: String)

    @Query("DELETE FROM set_logs WHERE id = :setId AND userId = :userId")
    suspend fun deleteSetLog(setId: String, userId: String)
}

@Dao
interface WeightLogDao {
    @Query("SELECT * FROM weight_logs WHERE userId = :userId ORDER BY recordedAt DESC, createdAt DESC")
    fun observeByUser(userId: String): Flow<List<WeightLogEntity>>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(entry: WeightLogEntity)

    @Query("DELETE FROM weight_logs WHERE id = :id AND userId = :userId")
    suspend fun deleteById(id: String, userId: String)
}
