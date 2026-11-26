package com.example.timer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.example.MainActivity

class RestTimerReceiver : BroadcastReceiver() {
    companion object {
        const val CHANNEL_ID = "iron_log_rest_timer"
        const val NOTIFICATION_ID = 7001
        const val EXTRA_EXERCISE_NAME = "extra_exercise_name"

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    val channel = NotificationChannel(
                        CHANNEL_ID,
                        "Cronômetro de Descanso",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Alertas ao finalizar o tempo de descanso entre séries"
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 250, 120, 250, 120, 350)
                        setSound(
                            soundUri,
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ALARM)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .build()
                        )
                    }
                    manager.createNotificationChannel(channel)
                }
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        ensureChannel(context)
        val exerciseName = intent.getStringExtra(EXTRA_EXERCISE_NAME) ?: "Próxima série"
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingOpen = PendingIntent.getActivity(
            context,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("FÉ & FERRO – Descanso finalizado!")
            .setContentText("Hora da próxima série: $exerciseName")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setVibrate(longArrayOf(0, 250, 120, 250, 120, 350))
            .setContentIntent(pendingOpen)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // Permission POST_NOTIFICATIONS not granted on Android 13+; foreground audio/vibration still works.
        }
    }
}
