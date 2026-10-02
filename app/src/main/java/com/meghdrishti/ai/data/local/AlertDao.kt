package com.meghdrishti.ai.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * DAO for alert history — supports offline-first operations.
 */
@Dao
interface AlertDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAlert(alert: AlertEntity): Long

    @Query("SELECT * FROM alert_history ORDER BY timestamp DESC")
    fun getAllAlerts(): Flow<List<AlertEntity>>

    @Query("SELECT * FROM alert_history WHERE alertLevel = :level ORDER BY timestamp DESC")
    fun getAlertsByLevel(level: String): Flow<List<AlertEntity>>

    @Query("SELECT * FROM alert_history ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentAlerts(limit: Int = 50): Flow<List<AlertEntity>>

    @Query("UPDATE alert_history SET acknowledged = 1 WHERE id = :alertId")
    suspend fun acknowledgeAlert(alertId: Long)

    @Query("SELECT COUNT(*) FROM alert_history WHERE alertLevel IN ('RED', 'EXTREME') AND acknowledged = 0")
    fun getUnacknowledgedCriticalCount(): Flow<Int>

    @Query("DELETE FROM alert_history WHERE timestamp < :cutoffTime")
    suspend fun purgeOldAlerts(cutoffTime: Long)
}
