package com.example.data

enum class UserRole {
    ALUNO,
    ADMIN
}

enum class MainTab {
    INICIO,
    TREINOS,
    HISTORICO,
    PERFIL
}

data class AlternativeOption(
    val key: String,
    val name: String,
    val defaultRestSec: Int
)

data class ProgressionInsight(
    val hasHistory: Boolean,
    val lastWeightKg: Double = 0.0,
    val summary: String = "",
    val shouldIncrease: Boolean = false
)

data class ExercisePr(
    val maxWeightKg: Double,
    val estimated1RmKg: Double,
    val maxSetVolumeKg: Double
)

data class ChartPoint(
    val label: String,
    val value: Double
)

data class ActiveSessionExerciseUi(
    val exercise: SessionExerciseEntity,
    val sets: List<SetLogEntity>,
    val progression: ProgressionInsight
)

data class ActiveSessionUi(
    val session: WorkoutSessionEntity,
    val items: List<ActiveSessionExerciseUi>
)

data class SessionDetailUi(
    val session: WorkoutSessionEntity,
    val items: List<ActiveSessionExerciseUi>
)

data class RestTimerState(
    val setId: String,
    val exerciseName: String,
    val plannedSec: Int,
    val startedAtMs: Long,
    val endAtMs: Long,
    val isPaused: Boolean,
    val pausedRemainingSec: Int
) {
    fun remainingSeconds(nowMs: Long = System.currentTimeMillis()): Int {
        if (isPaused) return pausedRemainingSec.coerceAtLeast(0)
        val diff = endAtMs - nowMs
        return if (diff <= 0L) 0 else ((diff + 999L) / 1000L).toInt()
    }
}
