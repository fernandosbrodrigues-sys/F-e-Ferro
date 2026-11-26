package com.example.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "users",
    indices = [Index(value = ["username"], unique = true)]
)
data class UserEntity(
    @PrimaryKey val id: String,
    val username: String,
    val passwordHash: String,
    val role: String, // "ALUNO" | "ADMIN"
    val isBlocked: Boolean = false,
    val createdAt: Long
)

@Entity(
    tableName = "user_sessions",
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["userId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["userId"])]
)
data class UserSessionEntity(
    @PrimaryKey val token: String,
    val userId: String,
    val createdAt: Long
)

@Entity(
    tableName = "workouts",
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["userId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["userId", "code"], unique = true)]
)
data class WorkoutEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val dayOfWeek: Int, // 1=Mon .. 7=Sun
    val code: String,
    val name: String,
    val subtitle: String,
    val sortOrder: Int
)

@Entity(
    tableName = "exercises",
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["userId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = WorkoutEntity::class,
            parentColumns = ["id"],
            childColumns = ["workoutId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["userId"]), Index(value = ["workoutId"])]
)
data class ExerciseEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val workoutId: String,
    val exerciseKey: String,
    val name: String,
    val targetSets: Int,
    val repMin: Int,
    val repMax: Int,
    val restMinSec: Int,
    val restMaxSec: Int,
    val defaultRestSec: Int,
    val isCompound: Boolean,
    val alternativesJson: String,
    val sortOrder: Int
)

@Entity(
    tableName = "workout_sessions",
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["userId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["userId", "status", "startedAt"])]
)
data class WorkoutSessionEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val workoutId: String?,
    val workoutName: String,
    val startedAt: Long,
    val completedAt: Long?,
    val status: String, // "in_progress" | "completed"
    val totalVolumeKg: Double
)

@Entity(
    tableName = "session_exercises",
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["userId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = WorkoutSessionEntity::class,
            parentColumns = ["id"],
            childColumns = ["sessionId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["userId"]), Index(value = ["sessionId", "sortOrder"])]
)
data class SessionExerciseEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val sessionId: String,
    val workoutExerciseId: String?,
    val originalExerciseKey: String,
    val originalExerciseName: String,
    val performedExerciseKey: String,
    val performedExerciseName: String,
    val targetSets: Int,
    val repMin: Int,
    val repMax: Int,
    val defaultRestSec: Int,
    val alternativesJson: String,
    val sortOrder: Int
)

@Entity(
    tableName = "set_logs",
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["userId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = WorkoutSessionEntity::class,
            parentColumns = ["id"],
            childColumns = ["sessionId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = SessionExerciseEntity::class,
            parentColumns = ["id"],
            childColumns = ["sessionExerciseId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["userId", "exerciseKey", "createdAt"]),
        Index(value = ["sessionId"]),
        Index(value = ["sessionExerciseId", "setNumber"])
    ]
)
data class SetLogEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val sessionId: String,
    val sessionExerciseId: String,
    val exerciseKey: String,
    val exerciseName: String,
    val setNumber: Int,
    val weightKg: Double?,
    val reps: Int?,
    val rir: Int?,
    val plannedRestSec: Int,
    val actualRestSec: Int?,
    val completed: Boolean,
    val completedAt: Long?,
    val createdAt: Long
)

@Entity(
    tableName = "weight_logs",
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["userId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["userId", "recordedAt"])]
)
data class WeightLogEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val weightKg: Double,
    val recordedAt: Long,
    val createdAt: Long
)
