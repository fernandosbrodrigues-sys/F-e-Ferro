package com.example.timer

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.example.data.RestTimerState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class RestTimerManager(
    private val context: Context,
    private val onTimerFinished: suspend (setId: String, actualRestSec: Int) -> Unit
) {
    private val prefs = context.getSharedPreferences("ironlog_rest_timer", Context.MODE_PRIVATE)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var tickJob: Job? = null

    private val _timerState = MutableStateFlow<RestTimerState?>(null)
    val timerState: StateFlow<RestTimerState?> = _timerState.asStateFlow()

    private val _remainingSeconds = MutableStateFlow(0)
    val remainingSeconds: StateFlow<Int> = _remainingSeconds.asStateFlow()

    companion object {
        private const val K_SET_ID = "set_id"
        private const val K_EX_NAME = "ex_name"
        private const val K_PLANNED = "planned_sec"
        private const val K_START = "started_at"
        private const val K_END = "end_at"
        private const val K_PAUSED = "is_paused"
        private const val K_PAUSED_REM = "paused_rem"
    }

    init {
        RestTimerReceiver.ensureChannel(context)
        restoreIfActive()
    }

    fun restoreIfActive() {
        val loaded = loadFromPrefs() ?: run {
            _timerState.value = null
            _remainingSeconds.value = 0
            return
        }
        val rem = loaded.remainingSeconds()
        if (!loaded.isPaused && rem <= 0) {
            val actual = ((System.currentTimeMillis() - loaded.startedAtMs) / 1000L).toInt()
                .coerceAtLeast(loaded.plannedSec)
            clearPrefs()
            cancelAlarm()
            _timerState.value = null
            _remainingSeconds.value = 0
            scope.launch { onTimerFinished(loaded.setId, actual) }
        } else {
            _timerState.value = loaded
            _remainingSeconds.value = rem
            if (!loaded.isPaused) startTicker()
        }
    }

    fun start(setId: String, exerciseName: String, plannedSec: Int) {
        val safePlanned = plannedSec.coerceIn(10, 600)
        val now = System.currentTimeMillis()
        val state = RestTimerState(
            setId = setId,
            exerciseName = exerciseName,
            plannedSec = safePlanned,
            startedAtMs = now,
            endAtMs = now + safePlanned * 1000L,
            isPaused = false,
            pausedRemainingSec = safePlanned
        )
        saveToPrefs(state)
        scheduleAlarm(state.endAtMs, state.exerciseName)
        _timerState.value = state
        _remainingSeconds.value = safePlanned
        startTicker()
    }

    fun togglePause() {
        val cur = _timerState.value ?: return
        val updated = if (cur.isPaused) {
            val now = System.currentTimeMillis()
            val newEnd = now + cur.pausedRemainingSec * 1000L
            scheduleAlarm(newEnd, cur.exerciseName)
            cur.copy(isPaused = false, endAtMs = newEnd)
        } else {
            val rem = cur.remainingSeconds()
            cancelAlarm()
            cur.copy(isPaused = true, pausedRemainingSec = rem)
        }
        saveToPrefs(updated)
        _timerState.value = updated
        _remainingSeconds.value = updated.remainingSeconds()
        if (updated.isPaused) {
            tickJob?.cancel()
        } else {
            startTicker()
        }
    }

    fun restart() {
        val cur = _timerState.value ?: return
        val now = System.currentTimeMillis()
        val updated = cur.copy(
            startedAtMs = now,
            endAtMs = now + cur.plannedSec * 1000L,
            isPaused = false,
            pausedRemainingSec = cur.plannedSec
        )
        saveToPrefs(updated)
        scheduleAlarm(updated.endAtMs, updated.exerciseName)
        _timerState.value = updated
        _remainingSeconds.value = cur.plannedSec
        startTicker()
    }

    fun adjust(deltaSec: Int) {
        val cur = _timerState.value ?: return
        val updated = if (cur.isPaused) {
            val nextRem = (cur.pausedRemainingSec + deltaSec).coerceAtLeast(5)
            cur.copy(pausedRemainingSec = nextRem)
        } else {
            val nextRem = (cur.remainingSeconds() + deltaSec).coerceAtLeast(5)
            val nextEnd = System.currentTimeMillis() + nextRem * 1000L
            scheduleAlarm(nextEnd, cur.exerciseName)
            cur.copy(endAtMs = nextEnd)
        }
        saveToPrefs(updated)
        _timerState.value = updated
        _remainingSeconds.value = updated.remainingSeconds()
    }

    fun skip() {
        finishInternal(skipped = true)
    }

    fun cancelSilently() {
        tickJob?.cancel()
        cancelAlarm()
        clearPrefs()
        _timerState.value = null
        _remainingSeconds.value = 0
    }

    private fun startTicker() {
        tickJob?.cancel()
        tickJob = scope.launch {
            while (isActive) {
                val cur = _timerState.value ?: break
                if (cur.isPaused) break
                val rem = cur.remainingSeconds()
                _remainingSeconds.value = rem
                if (rem <= 0) {
                    finishInternal(skipped = false)
                    break
                }
                delay(250L)
            }
        }
    }

    private fun finishInternal(skipped: Boolean) {
        val cur = _timerState.value ?: loadFromPrefs() ?: return
        tickJob?.cancel()
        cancelAlarm()
        clearPrefs()

        val elapsed = if (cur.isPaused) {
            (cur.plannedSec - cur.pausedRemainingSec).coerceAtLeast(0)
        } else {
            ((System.currentTimeMillis() - cur.startedAtMs) / 1000L).toInt().coerceAtLeast(0)
        }
        val actual = if (skipped) elapsed else maxOf(cur.plannedSec, elapsed)

        _timerState.value = null
        _remainingSeconds.value = 0

        if (!skipped) {
            playBeepAndVibrate()
        }
        scope.launch {
            onTimerFinished(cur.setId, actual)
        }
    }

    private fun playBeepAndVibrate() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 220, 100, 220, 100, 360), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(longArrayOf(0, 220, 100, 220, 100, 360), -1)
            }
        } catch (_: Exception) {
        }

        scope.launch(Dispatchers.Default) {
            try {
                val tg = ToneGenerator(AudioManager.STREAM_ALARM, 90)
                tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 350)
                delay(420)
                tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 350)
                delay(420)
                tg.release()
            } catch (_: Exception) {
            }
        }
    }

    private fun alarmPendingIntent(exerciseName: String): PendingIntent {
        val intent = Intent(context, RestTimerReceiver::class.java).apply {
            putExtra(RestTimerReceiver.EXTRA_EXERCISE_NAME, exerciseName)
        }
        return PendingIntent.getBroadcast(
            context,
            8801,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun scheduleAlarm(triggerAtMs: Long, exerciseName: String) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = alarmPendingIntent(exerciseName)
        try {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi)
        } catch (_: Exception) {
        }
    }

    private fun cancelAlarm() {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(alarmPendingIntent(""))
    }

    private fun saveToPrefs(s: RestTimerState) {
        prefs.edit()
            .putString(K_SET_ID, s.setId)
            .putString(K_EX_NAME, s.exerciseName)
            .putInt(K_PLANNED, s.plannedSec)
            .putLong(K_START, s.startedAtMs)
            .putLong(K_END, s.endAtMs)
            .putBoolean(K_PAUSED, s.isPaused)
            .putInt(K_PAUSED_REM, s.pausedRemainingSec)
            .apply()
    }

    private fun loadFromPrefs(): RestTimerState? {
        val setId = prefs.getString(K_SET_ID, null) ?: return null
        val name = prefs.getString(K_EX_NAME, null) ?: return null
        return RestTimerState(
            setId = setId,
            exerciseName = name,
            plannedSec = prefs.getInt(K_PLANNED, 90),
            startedAtMs = prefs.getLong(K_START, 0L),
            endAtMs = prefs.getLong(K_END, 0L),
            isPaused = prefs.getBoolean(K_PAUSED, false),
            pausedRemainingSec = prefs.getInt(K_PAUSED_REM, 0)
        )
    }

    private fun clearPrefs() {
        prefs.edit().clear().apply()
    }
}
