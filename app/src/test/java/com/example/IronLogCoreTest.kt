package com.example

import com.example.data.RestTimerState
import com.example.data.SecurityUtils
import com.example.data.WorkoutSeed
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class IronLogCoreTest {
    @Test
    fun passwordHashingAndVerificationWorks() {
        val hash = SecurityUtils.hashPassword("Senh@Forte123")
        assertTrue(SecurityUtils.verifyPassword("Senh@Forte123", hash))
        assertFalse(SecurityUtils.verifyPassword("SenhaErrada", hash))
    }

    @Test
    fun emailValidationAndLegacyLoginEnforceRules() {
        assertTrue(SecurityUtils.isValidEmail("nome@sobrenome.com"))
        assertTrue(SecurityUtils.isValidEmail("aluno01@empresa.org"))
        assertFalse(SecurityUtils.isValidEmail("ab"))
        assertFalse(SecurityUtils.isValidEmail("sem-arroba.com"))
        assertTrue(SecurityUtils.isValidLoginIdentifier("nome@sobrenome.com"))
        assertTrue(SecurityUtils.isValidLoginIdentifier("admin"))
    }

    @Test
    fun workoutSeedContainsAllFourSplitDaysAndAlternatives() {
        val (workouts, exercises) = WorkoutSeed.buildForUser("user-1")
        assertEquals(4, workouts.size)
        assertEquals(listOf("UPPER_A", "LOWER_A", "UPPER_B", "LOWER_B"), workouts.map { it.code })
        assertEquals(28, exercises.size)
        assertTrue(exercises.all { WorkoutSeed.decodeAlternatives(it.alternativesJson).isNotEmpty() })
    }

    @Test
    fun restTimerRemainingSecondsHandlesLockElapsedTime() {
        val start = 1_000_000L
        val state = RestTimerState(
            setId = "s1",
            exerciseName = "Supino reto com barra",
            plannedSec = 120,
            startedAtMs = start,
            endAtMs = start + 120_000L,
            isPaused = false,
            pausedRemainingSec = 120
        )
        assertEquals(60, state.remainingSeconds(start + 60_000L))
        assertEquals(0, state.remainingSeconds(start + 125_000L))
    }

    @Test
    fun restScheduleCascadesMondayWorkoutToTuesdayAndSoOn() {
        val (workouts, _) = WorkoutSeed.buildForUser("user-1")
        val initial = WorkoutSeed.buildSlotsFromWorkouts(workouts)
        val afterMondayRest = WorkoutSeed.setDayAsRest(initial, 1)

        assertEquals(null, afterMondayRest[1])
        assertEquals("UPPER_A", afterMondayRest[2]?.code)
        assertEquals("LOWER_A", afterMondayRest[3]?.code)
        assertEquals("UPPER_B", afterMondayRest[4]?.code)
        assertEquals("LOWER_B", afterMondayRest[5]?.code)
        assertEquals("TERÇA – UPPER A", WorkoutSeed.formatWorkoutNameForDay(2, "UPPER_A"))
    }
}
