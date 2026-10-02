package com.meghdrishti.ai

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.google.firebase.FirebaseApp

/**
 * MeghDrishti AI Application class.
 * Ensures Firebase is initialized before any Activity or Service accesses it.
 * Creates notification channels for tiered disaster alerts.
 */
class MeghDrishtiApplication : Application() {

    companion object {
        const val CHANNEL_ALERT_CRITICAL = "meghdrishti_critical_alerts"
        const val CHANNEL_ALERT_WARNING = "meghdrishti_warnings"
        const val CHANNEL_ALERT_ADVISORY = "meghdrishti_advisory"
    }

    override fun onCreate() {
        super.onCreate()

        // Initialize Firebase safely before any component accesses it
        try {
            FirebaseApp.initializeApp(this)
        } catch (_: Exception) {
            // Firebase may not be configured in development/testing
        }

        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            val criticalChannel = NotificationChannel(
                CHANNEL_ALERT_CRITICAL,
                "Critical Scenario Drills",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Critical local scenario notifications; not official public warnings"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
            }

            val warningChannel = NotificationChannel(
                CHANNEL_ALERT_WARNING,
                "Weather Scenario Drills",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Local weather scenario notifications; not official warnings"
                enableVibration(true)
            }

            val advisoryChannel = NotificationChannel(
                CHANNEL_ALERT_ADVISORY,
                "Scenario Advisories",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Non-official scenario analysis"
            }

            manager.createNotificationChannels(
                listOf(criticalChannel, warningChannel, advisoryChannel)
            )
        }
    }
}
