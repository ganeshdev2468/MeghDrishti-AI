package com.meghdrishti.ai.util

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import com.meghdrishti.ai.MeghDrishtiApplication
import com.meghdrishti.ai.MainActivity
import com.meghdrishti.ai.data.model.ImdAlertLevel

/**
 * Local drill notification dispatcher with tiered haptic feedback and heads-up display.
 */
class EmergencyNotificationHelper(private val context: Context) {

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    /**
    * Dispatch a local drill notification. This does not contact response agencies.
     */
    fun dispatchAlert(
        alertLevel: ImdAlertLevel,
        title: String,
        message: String,
        location: String,
        notificationId: Int = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
    ) {
        val channelId = when (alertLevel) {
            ImdAlertLevel.RED, ImdAlertLevel.EXTREME ->
                MeghDrishtiApplication.CHANNEL_ALERT_CRITICAL
            ImdAlertLevel.ORANGE, ImdAlertLevel.YELLOW ->
                MeghDrishtiApplication.CHANNEL_ALERT_WARNING
            else ->
                MeghDrishtiApplication.CHANNEL_ALERT_ADVISORY
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("ALERT_LEVEL", alertLevel.name)
            putExtra("LOCATION", location)
        }

        val pendingIntent = PendingIntent.getActivity(
            context, notificationId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val emoji = when (alertLevel) {
            ImdAlertLevel.EXTREME -> "🔴⚠️"
            ImdAlertLevel.RED -> "🔴"
            ImdAlertLevel.ORANGE -> "🟠"
            ImdAlertLevel.YELLOW -> "🟡"
            ImdAlertLevel.GREEN -> "🟢"
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("$emoji DRILL · $title")
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(
                "$message\n\n📍 Location: $location\n⏰ ${java.text.SimpleDateFormat(
                    "dd MMM yyyy HH:mm IST", java.util.Locale.US
                ).format(java.util.Date())}"
            ))
            .setPriority(
                if (alertLevel == ImdAlertLevel.RED || alertLevel == ImdAlertLevel.EXTREME)
                    NotificationCompat.PRIORITY_HIGH
                else NotificationCompat.PRIORITY_DEFAULT
            )
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .build()

        notificationManager.notify(notificationId, notification)

        // Trigger haptic feedback for critical alerts
        if (alertLevel == ImdAlertLevel.RED || alertLevel == ImdAlertLevel.EXTREME) {
            triggerEmergencyVibration()
        }
    }

    private fun triggerEmergencyVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator.vibrate(
                    VibrationEffect.createWaveform(
                        longArrayOf(0, 500, 200, 500, 200, 800), -1
                    )
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                vibrator.vibrate(
                    VibrationEffect.createWaveform(
                        longArrayOf(0, 500, 200, 500, 200, 800), -1
                    )
                )
            }
        } catch (_: Exception) { }
    }

    /**
     * Generate CAP (Common Alerting Protocol) v1.2 XML for the alert.
     */
    fun generateCapXml(
        alertLevel: ImdAlertLevel,
        location: String,
        latitude: Double,
        longitude: Double,
        message: String
    ): String {
        val severity = when (alertLevel) {
            ImdAlertLevel.EXTREME -> "Extreme"
            ImdAlertLevel.RED -> "Severe"
            ImdAlertLevel.ORANGE -> "Moderate"
            ImdAlertLevel.YELLOW -> "Minor"
            ImdAlertLevel.GREEN -> "Minor"
        }
        val urgency = if (alertLevel >= ImdAlertLevel.RED) "Immediate" else "Expected"

        return """
<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>MEGHDRISHTI-${System.currentTimeMillis()}</identifier>
    <sender>MeghDrishti AI local drill</sender>
  <sent>${java.time.OffsetDateTime.now()}</sent>
    <status>Test</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>Heavy Rainfall / Flash Flood Warning</event>
    <urgency>$urgency</urgency>
    <severity>$severity</severity>
    <certainty>Likely</certainty>
    <headline>DRILL ONLY: ${alertLevel.label} for $location</headline>
    <description>SIMULATION ONLY. Not an official warning. $message</description>
    <area>
      <areaDesc>$location</areaDesc>
      <circle>$latitude,$longitude 25.0</circle>
    </area>
  </info>
</alert>
        """.trimIndent()
    }
}
