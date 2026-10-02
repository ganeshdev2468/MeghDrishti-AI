package com.meghdrishti.ai.data.model

import com.google.firebase.Timestamp

// ═══════════════════════════════════════════════════════════
// Firestore Cloud Models — Emergency Response Persistence
// ═══════════════════════════════════════════════════════════

/**
 * Emergency alert stored in Firestore for cross-device synchronization.
 */
data class FirestoreAlert(
    val id: String = "",
    val alertLevel: String = "GREEN",
    val location: String = "",
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val rainfallIntensity: Double = 0.0,
    val floodDepth: Double = 0.0,
    val message: String = "",
    val capXml: String = "",
    val timestamp: Timestamp = Timestamp.now(),
    val createdBy: String = "",
    val acknowledged: Boolean = false
)

/**
 * Responder profile for emergency service personnel.
 */
data class ResponderProfile(
    val uid: String = "",
    val displayName: String = "",
    val email: String = "",
    val agency: String = "",          // "NDRF", "Municipal", "Traffic Police", etc.
    val designation: String = "",
    val isActive: Boolean = true,
    val lastCheckin: Timestamp = Timestamp.now()
)

/**
 * Deployment log for tracking resource dispatch.
 */
data class DeploymentLog(
    val id: String = "",
    val alertId: String = "",
    val resourceType: String = "",    // "NDRF Battalion", "Rescue Boat", "Pump"
    val quantity: Int = 0,
    val deployedTo: String = "",
    val status: String = "DISPATCHED", // DISPATCHED, EN_ROUTE, ON_SITE, COMPLETED
    val timestamp: Timestamp = Timestamp.now(),
    val deployedBy: String = ""
)

/**
 * GIS Inundation scenario persisted to Firestore.
 */
data class FirestoreInundationScenario(
    val id: String = "",
    val returnPeriod: Int = 10,
    val rainfallIntensity: Double = 0.0,
    val maxFloodDepth: Double = 0.0,
    val floodedArea: Double = 0.0,
    val geoJsonExport: String = "",
    val timestamp: Timestamp = Timestamp.now(),
    val createdBy: String = ""
)
