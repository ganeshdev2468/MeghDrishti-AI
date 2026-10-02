package com.meghdrishti.ai.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Local Room entity for persisting emergency alert history.
 * Provides offline-first audit trail for disaster response actions.
 */
@Entity(tableName = "alert_history")
data class AlertEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val alertLevel: String,
    val location: String,
    val latitude: Double,
    val longitude: Double,
    val rainfallIntensity: Double,
    val floodDepth: Double,
    val message: String,
    val timestamp: Long = System.currentTimeMillis(),
    val notificationSent: Boolean = false,
    val acknowledged: Boolean = false,
    val capXml: String = ""
)
