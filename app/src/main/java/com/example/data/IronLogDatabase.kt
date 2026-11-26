package com.example.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        UserEntity::class,
        UserSessionEntity::class,
        WorkoutEntity::class,
        ExerciseEntity::class,
        WorkoutSessionEntity::class,
        SessionExerciseEntity::class,
        SetLogEntity::class,
        WeightLogEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class IronLogDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun userSessionDao(): UserSessionDao
    abstract fun workoutDao(): WorkoutDao
    abstract fun trainingDao(): TrainingDao
    abstract fun weightLogDao(): WeightLogDao

    companion object {
        @Volatile
        private var INSTANCE: IronLogDatabase? = null

        fun getInstance(context: Context): IronLogDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    IronLogDatabase::class.java,
                    "iron_log.db"
                )
                    .fallbackToDestructiveMigration(false)
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
