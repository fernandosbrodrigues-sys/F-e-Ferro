package com.example.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.ActiveSessionExerciseUi
import com.example.data.ActiveSessionUi
import com.example.data.AlternativeOption
import com.example.data.ChartPoint
import com.example.data.ExerciseEntity
import com.example.data.ExercisePr
import com.example.data.IronLogRepository
import com.example.data.MainTab
import com.example.data.ProgressionInsight
import com.example.data.RestTimerState
import com.example.data.SessionDetailUi
import com.example.data.SessionExerciseEntity
import com.example.data.SetLogEntity
import com.example.data.UserEntity
import com.example.data.UserRole
import com.example.data.WeightLogEntity
import com.example.data.WorkoutEntity
import com.example.data.WorkoutSessionEntity
import com.example.timer.RestTimerManager
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class IronLogUiState(
    val isBooting: Boolean = true,
    val hasAdmin: Boolean = true,
    val currentUser: UserEntity? = null,
    val currentTab: MainTab = MainTab.INICIO,
    val workouts: List<WorkoutEntity> = emptyList(),
    val exercises: List<ExerciseEntity> = emptyList(),
    val sessions: List<WorkoutSessionEntity> = emptyList(),
    val sessionExercises: List<SessionExerciseEntity> = emptyList(),
    val setLogs: List<SetLogEntity> = emptyList(),
    val weightLogs: List<WeightLogEntity> = emptyList(),
    val activeSession: ActiveSessionUi? = null,
    val adminPanelOpen: Boolean = false,
    val adminUsers: List<UserEntity> = emptyList(),
    val toastMessage: String? = null,
    val toastIsError: Boolean = false
)

@OptIn(ExperimentalCoroutinesApi::class)
class IronLogViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = IronLogRepository(application)

    private val _isBooting = MutableStateFlow(true)
    private val _currentUserId = MutableStateFlow<String?>(null)
    private val _currentTab = MutableStateFlow(MainTab.INICIO)
    private val _adminPanelOpen = MutableStateFlow(false)
    private val _adminUsers = MutableStateFlow<List<UserEntity>>(emptyList())
    private val _toast = MutableStateFlow<Pair<String, Boolean>?>(null)

    val timerManager = RestTimerManager(application) { setId, actualRestSec ->
        val uid = _currentUserId.value ?: return@RestTimerManager
        repo.recordActualRest(uid, setId, actualRestSec)
    }

    val timerState: StateFlow<RestTimerState?> = timerManager.timerState
    val timerRemainingSec: StateFlow<Int> = timerManager.remainingSeconds

    private val userFlow = _currentUserId.flatMapLatest { uid ->
        if (uid == null) flowOf(null) else repo.observeUser(uid)
    }
    private val workoutsFlow = _currentUserId.flatMapLatest { uid ->
        if (uid == null) flowOf(emptyList()) else repo.observeWorkouts(uid)
    }
    private val exercisesFlow = _currentUserId.flatMapLatest { uid ->
        if (uid == null) flowOf(emptyList()) else repo.observeExercises(uid)
    }
    private val sessionsFlow = _currentUserId.flatMapLatest { uid ->
        if (uid == null) flowOf(emptyList()) else repo.observeSessions(uid)
    }
    private val sessionExercisesFlow = _currentUserId.flatMapLatest { uid ->
        if (uid == null) flowOf(emptyList()) else repo.observeSessionExercises(uid)
    }
    private val setLogsFlow = _currentUserId.flatMapLatest { uid ->
        if (uid == null) flowOf(emptyList()) else repo.observeSetLogs(uid)
    }
    private val weightLogsFlow = _currentUserId.flatMapLatest { uid ->
        if (uid == null) flowOf(emptyList()) else repo.observeWeightLogs(uid)
    }

    private data class UserBundle(
        val user: UserEntity?,
        val workouts: List<WorkoutEntity>,
        val exercises: List<ExerciseEntity>,
        val sessions: List<WorkoutSessionEntity>,
        val sessionExercises: List<SessionExerciseEntity>,
        val setLogs: List<SetLogEntity>,
        val weightLogs: List<WeightLogEntity>
    )

    private val userBundleFlow = combine(
        userFlow,
        workoutsFlow,
        exercisesFlow,
        sessionsFlow,
        sessionExercisesFlow,
        setLogsFlow,
        weightLogsFlow
    ) { arr ->
        @Suppress("UNCHECKED_CAST")
        UserBundle(
            user = arr[0] as UserEntity?,
            workouts = arr[1] as List<WorkoutEntity>,
            exercises = arr[2] as List<ExerciseEntity>,
            sessions = arr[3] as List<WorkoutSessionEntity>,
            sessionExercises = arr[4] as List<SessionExerciseEntity>,
            setLogs = arr[5] as List<SetLogEntity>,
            weightLogs = arr[6] as List<WeightLogEntity>
        )
    }

    val uiState: StateFlow<IronLogUiState> = combine(
        _isBooting,
        repo.observeAdminCount(),
        _currentTab,
        _adminPanelOpen,
        _adminUsers,
        _toast,
        userBundleFlow
    ) { arr ->
        @Suppress("UNCHECKED_CAST")
        val isBooting = arr[0] as Boolean
        val adminCount = arr[1] as Int
        val tab = arr[2] as MainTab
        val adminOpen = arr[3] as Boolean
        val adminUsers = arr[4] as List<UserEntity>
        val toast = arr[5] as Pair<String, Boolean>?
        val bundle = arr[6] as UserBundle

        val activeSess = bundle.sessions.firstOrNull { it.status == "in_progress" }
        val activeUi = if (activeSess != null) {
            val items = bundle.sessionExercises
                .filter { it.sessionId == activeSess.id }
                .sortedBy { it.sortOrder }
                .map { se ->
                    val sets = bundle.setLogs
                        .filter { it.sessionExerciseId == se.id }
                        .sortedBy { it.setNumber }
                    val prog = computeProgression(
                        exerciseKey = se.performedExerciseKey,
                        targetSets = se.targetSets,
                        repMax = se.repMax,
                        sessions = bundle.sessions,
                        setLogs = bundle.setLogs
                    )
                    ActiveSessionExerciseUi(se, sets, prog)
                }
            ActiveSessionUi(activeSess, items)
        } else {
            null
        }

        IronLogUiState(
            isBooting = isBooting,
            hasAdmin = adminCount > 0,
            currentUser = bundle.user,
            currentTab = tab,
            workouts = bundle.workouts,
            exercises = bundle.exercises,
            sessions = bundle.sessions,
            sessionExercises = bundle.sessionExercises,
            setLogs = bundle.setLogs,
            weightLogs = bundle.weightLogs,
            activeSession = activeUi,
            adminPanelOpen = adminOpen,
            adminUsers = adminUsers,
            toastMessage = toast?.first,
            toastIsError = toast?.second ?: false
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), IronLogUiState())

    init {
        viewModelScope.launch {
            val restored = repo.restoreSession()
            _currentUserId.value = restored?.id
            _isBooting.value = false
            timerManager.restoreIfActive()
        }
    }

    fun clearToast() {
        _toast.value = null
    }

    private fun toast(msg: String, isError: Boolean = false) {
        _toast.value = msg to isError
    }

    fun selectTab(tab: MainTab) {
        _currentTab.value = tab
        if (tab != MainTab.PERFIL) _adminPanelOpen.value = false
    }

    // =========================================================================
    // AUTH
    // =========================================================================
    fun claimInitialAdmin(username: String, password: String, confirm: String) {
        viewModelScope.launch {
            repo.claimInitialAdmin(username, password, confirm)
                .onSuccess { user ->
                    _currentUserId.value = user.id
                    toast("Conta ADMIN configurada!")
                }
                .onFailure { toast(it.message ?: "Erro ao configurar ADMIN.", true) }
        }
    }

    fun registerStudent(username: String, password: String, confirm: String) {
        viewModelScope.launch {
            repo.registerStudent(username, password, confirm)
                .onSuccess { user ->
                    _currentUserId.value = user.id
                    toast("Conta criada com sucesso!")
                }
                .onFailure { toast(it.message ?: "Erro ao cadastrar.", true) }
        }
    }

    fun login(username: String, password: String) {
        viewModelScope.launch {
            repo.login(username, password)
                .onSuccess { user ->
                    _currentUserId.value = user.id
                    _currentTab.value = MainTab.INICIO
                    _adminPanelOpen.value = false
                }
                .onFailure { toast(it.message ?: "Falha ao entrar.", true) }
        }
    }

    fun logout() {
        viewModelScope.launch {
            timerManager.cancelSilently()
            repo.logout()
            _currentUserId.value = null
            _adminPanelOpen.value = false
            _adminUsers.value = emptyList()
            _currentTab.value = MainTab.INICIO
        }
    }

    // =========================================================================
    // TREINOS E SÉRIES
    // =========================================================================
    fun updateWorkoutSchedule(assignments: List<Pair<String, Int>>) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.updateWorkoutSchedule(uid, assignments)
                .onSuccess { toast("Escala de descanso atualizada!") }
                .onFailure { toast(it.message ?: "Erro ao atualizar escala.", true) }
        }
    }

    fun startWorkout(workoutId: String) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.startWorkout(uid, workoutId)
                .onSuccess { _currentTab.value = MainTab.TREINOS }
                .onFailure { toast(it.message ?: "Erro ao iniciar treino.", true) }
        }
    }

    fun updateSetField(setId: String, weightKg: Double?, reps: Int?, rir: Int?, plannedRestSec: Int) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.updateSetField(uid, setId, weightKg, reps, rir, plannedRestSec)
        }
    }

    fun toggleSetCompleted(setId: String) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            val updated = repo.toggleSetCompleted(uid, setId) ?: return@launch
            if (updated.completed) {
                timerManager.start(updated.id, updated.exerciseName, updated.plannedRestSec)
            }
        }
    }

    fun addSet(sessionExerciseId: String) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.addSet(uid, sessionExerciseId)
        }
    }

    fun deleteSet(setId: String) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.deleteSet(uid, setId)
        }
    }

    fun substituteExercise(sessionExerciseId: String, option: AlternativeOption) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.substituteExercise(uid, sessionExerciseId, option)
            toast("Alterado para ${option.name}")
        }
    }

    fun editHistoricalExerciseVariation(sessionExerciseId: String, option: AlternativeOption) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.editHistoricalExerciseVariation(uid, sessionExerciseId, option)
            toast("Exercício atualizado para ${option.name}")
        }
    }

    fun finishActiveSession() {
        val uid = _currentUserId.value ?: return
        val sessionId = uiState.value.activeSession?.session?.id ?: return
        viewModelScope.launch {
            if (timerState.value != null) timerManager.skip()
            repo.finishSession(uid, sessionId)
            _currentTab.value = MainTab.HISTORICO
            toast("Treino finalizado!")
        }
    }

    fun discardActiveSession() {
        val uid = _currentUserId.value ?: return
        val sessionId = uiState.value.activeSession?.session?.id ?: return
        viewModelScope.launch {
            timerManager.cancelSilently()
            repo.discardSession(uid, sessionId)
            toast("Treino descartado.")
        }
    }

    // =========================================================================
    // PESO CORPORAL
    // =========================================================================
    fun logBodyWeight(weightKg: Double) {
        val uid = _currentUserId.value ?: return
        if (weightKg <= 0.0) {
            toast("Informe um peso válido.", true)
            return
        }
        viewModelScope.launch {
            repo.logBodyWeight(uid, weightKg)
            toast("Peso registrado.")
        }
    }

    fun deleteBodyWeight(weightId: String) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.deleteBodyWeight(uid, weightId)
        }
    }

    // =========================================================================
    // ADMIN
    // =========================================================================
    fun openAdminPanel() {
        val caller = uiState.value.currentUser ?: return
        if (caller.role != UserRole.ADMIN.name) return
        _adminPanelOpen.value = true
        refreshAdminUsers()
    }

    fun closeAdminPanel() {
        _adminPanelOpen.value = false
    }

    fun refreshAdminUsers() {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.listUsersAsAdmin(uid)
                .onSuccess { _adminUsers.value = it }
                .onFailure { toast(it.message ?: "Acesso negado.", true) }
        }
    }

    fun adminCreateUser(username: String, password: String, role: UserRole) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.createUserAsAdmin(uid, username, password, role)
                .onSuccess {
                    toast("Conta ${com.example.data.SecurityUtils.formatDisplayIdentifier(it.username)} criada!")
                    refreshAdminUsers()
                }
                .onFailure { toast(it.message ?: "Erro ao criar conta.", true) }
        }
    }

    fun adminToggleBlock(targetUserId: String, blocked: Boolean) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.setUserBlockedAsAdmin(uid, targetUserId, blocked)
                .onSuccess {
                    toast(if (blocked) "Usuário bloqueado." else "Usuário desbloqueado.")
                    refreshAdminUsers()
                }
                .onFailure { toast(it.message ?: "Erro ao atualizar usuário.", true) }
        }
    }

    fun adminResetPassword(targetUserId: String, newPassword: String, confirm: String) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.resetPasswordAsAdmin(uid, targetUserId, newPassword, confirm)
                .onSuccess {
                    toast("Senha redefinida com sucesso.")
                }
                .onFailure { toast(it.message ?: "Erro ao redefinir senha.", true) }
        }
    }

    fun adminDeleteUser(targetUserId: String) {
        val uid = _currentUserId.value ?: return
        viewModelScope.launch {
            repo.deleteUserAsAdmin(uid, targetUserId)
                .onSuccess {
                    toast("Usuário excluído.")
                    refreshAdminUsers()
                }
                .onFailure { toast(it.message ?: "Erro ao excluir usuário.", true) }
        }
    }

    // =========================================================================
    // CÁLCULOS DE PROGRESSÃO, PRs, VOLUME E DATAS
    // =========================================================================
    fun getSessionDetail(sessionId: String): SessionDetailUi? {
        val state = uiState.value
        val sess = state.sessions.firstOrNull { it.id == sessionId } ?: return null
        val items = state.sessionExercises
            .filter { it.sessionId == sessionId }
            .sortedBy { it.sortOrder }
            .map { se ->
                val sets = state.setLogs
                    .filter { it.sessionExerciseId == se.id }
                    .sortedBy { it.setNumber }
                ActiveSessionExerciseUi(se, sets, ProgressionInsight(false))
            }
        return SessionDetailUi(sess, items)
    }

    fun computeProgression(
        exerciseKey: String,
        targetSets: Int,
        repMax: Int,
        sessions: List<WorkoutSessionEntity>,
        setLogs: List<SetLogEntity>
    ): ProgressionInsight {
        val completedSessionIds = sessions.filter { it.status == "completed" }.map { it.id }.toSet()
        val matchingLogs = setLogs.filter {
            it.exerciseKey == exerciseKey && it.completed && it.sessionId in completedSessionIds
        }
        if (matchingLogs.isEmpty()) return ProgressionInsight(hasHistory = false)

        val lastSession = sessions.firstOrNull { sess ->
            sess.status == "completed" && matchingLogs.any { it.sessionId == sess.id }
        } ?: return ProgressionInsight(hasHistory = false)

        val lastSets = matchingLogs
            .filter { it.sessionId == lastSession.id }
            .sortedBy { it.setNumber }

        val summary = lastSets.joinToString(" | ") { s ->
            val w = formatKg(s.weightKg ?: 0.0)
            val r = s.reps ?: 0
            val rirTxt = s.rir?.let { " (RIR $it)" } ?: ""
            "${w}kg×$r$rirTxt"
        }

        val lastWeight = lastSets.maxOfOrNull { it.weightKg ?: 0.0 } ?: 0.0
        val shouldIncrease = lastSets.size >= targetSets &&
            lastSets.all { (it.reps ?: 0) >= repMax && it.rir != null && it.rir <= 3 }

        return ProgressionInsight(
            hasHistory = true,
            lastWeightKg = lastWeight,
            summary = summary,
            shouldIncrease = shouldIncrease
        )
    }

    fun computeExerciseStats(
        exerciseKey: String,
        sessions: List<WorkoutSessionEntity>,
        setLogs: List<SetLogEntity>
    ): Pair<ExercisePr, List<ChartPoint>> {
        val completedSessions = sessions.filter { it.status == "completed" }
        val completedIds = completedSessions.map { it.id }.toSet()
        val logs = setLogs.filter {
            it.exerciseKey == exerciseKey && it.completed && it.sessionId in completedIds
        }

        var maxWeight = 0.0
        var maxEst1Rm = 0.0
        var maxSetVol = 0.0
        logs.forEach { l ->
            val w = l.weightKg ?: 0.0
            val r = l.reps ?: 0
            if (w > maxWeight) maxWeight = w
            if (w * r > maxSetVol) maxSetVol = w * r
            val e1rm = if (r > 0) w * (1.0 + r / 30.0) else w
            if (e1rm > maxEst1Rm) maxEst1Rm = e1rm
        }

        val points = completedSessions
            .reversed()
            .mapNotNull { sess ->
                val sLogs = logs.filter { it.sessionId == sess.id }
                if (sLogs.isEmpty()) null
                else {
                    val topW = sLogs.maxOf { it.weightKg ?: 0.0 }
                    ChartPoint(formatShortDate(sess.startedAt), topW)
                }
            }
            .takeLast(8)

        return ExercisePr(maxWeight, maxEst1Rm, maxSetVol) to points
    }

    fun computeWeeklyVolumeBars(sessions: List<WorkoutSessionEntity>): List<ChartPoint> {
        val completed = sessions.filter { it.status == "completed" }
        val curWeekStart = startOfWeekMillis()
        val weekMs = 7L * 24L * 3600L * 1000L
        return (5 downTo 0).map { i ->
            val ws = curWeekStart - i * weekMs
            val we = ws + weekMs
            val vol = completed
                .filter { it.startedAt in ws until we }
                .sumOf { it.totalVolumeKg }
            ChartPoint(formatShortDate(ws), vol)
        }
    }

    companion object {
        fun currentIsoDayOfWeek(): Int {
            return when (Calendar.getInstance().get(Calendar.DAY_OF_WEEK)) {
                Calendar.MONDAY -> 1
                Calendar.TUESDAY -> 2
                Calendar.WEDNESDAY -> 3
                Calendar.THURSDAY -> 4
                Calendar.FRIDAY -> 5
                Calendar.SATURDAY -> 6
                else -> 7
            }
        }

        fun dayNamePt(isoDay: Int): String = when (isoDay) {
            1 -> "Segunda-feira"
            2 -> "Terça-feira"
            3 -> "Quarta-feira"
            4 -> "Quinta-feira"
            5 -> "Sexta-feira"
            6 -> "Sábado"
            else -> "Domingo"
        }

        fun shortDayPt(isoDay: Int): String = when (isoDay) {
            1 -> "Seg"
            2 -> "Ter"
            3 -> "Qua"
            4 -> "Qui"
            5 -> "Sex"
            6 -> "Sáb"
            else -> "Dom"
        }

        fun startOfWeekMillis(nowMs: Long = System.currentTimeMillis()): Long {
            val cal = Calendar.getInstance().apply {
                timeInMillis = nowMs
                firstDayOfWeek = Calendar.MONDAY
                set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            if (cal.timeInMillis > nowMs) {
                cal.add(Calendar.DAY_OF_YEAR, -7)
            }
            return cal.timeInMillis
        }

        fun formatDate(ms: Long): String =
            SimpleDateFormat("dd/MM/yy", Locale("pt", "BR")).format(Date(ms))

        fun formatShortDate(ms: Long): String =
            SimpleDateFormat("dd/MM", Locale("pt", "BR")).format(Date(ms))

        fun formatClock(sec: Int): String {
            val s = sec.coerceAtLeast(0)
            val m = s / 60
            val r = s % 60
            return String.format(Locale.US, "%02d:%02d", m, r)
        }

        fun formatKg(kg: Double): String {
            return if (kg % 1.0 == 0.0) kg.toInt().toString() else String.format(Locale.US, "%.1f", kg)
        }
    }
}
