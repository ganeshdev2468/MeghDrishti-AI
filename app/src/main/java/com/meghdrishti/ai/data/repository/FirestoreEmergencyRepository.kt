package com.meghdrishti.ai.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.meghdrishti.ai.data.model.DeploymentLog
import com.meghdrishti.ai.data.model.FirestoreAlert
import com.meghdrishti.ai.data.model.FirestoreInundationScenario
import com.meghdrishti.ai.data.model.ResponderProfile
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Firestore repository for cloud-persisted emergency response data.
 * Uses lazy initialization to prevent crashes if Firebase is not configured.
 */
class FirestoreEmergencyRepository {

    private val firestore: FirebaseFirestore? by lazy {
        try {
            FirebaseFirestore.getInstance()
        } catch (_: Exception) {
            null
        }
    }

    private val auth: FirebaseAuth? by lazy {
        try {
            FirebaseAuth.getInstance()
        } catch (_: Exception) {
            null
        }
    }

    // ── Alert Operations ──

    suspend fun publishAlert(alert: FirestoreAlert): Boolean {
        return try {
            val uid = auth?.currentUser?.uid ?: return false
            val db = firestore ?: return false
            val data = hashMapOf(
                "alertLevel" to alert.alertLevel,
                "location" to alert.location,
                "latitude" to alert.latitude,
                "longitude" to alert.longitude,
                "rainfallIntensity" to alert.rainfallIntensity,
                "floodDepth" to alert.floodDepth,
                "message" to alert.message,
                "capXml" to alert.capXml,
                "timestamp" to alert.timestamp,
                "createdBy" to uid,
                "acknowledged" to false
            )
            db.collection("emergency_alerts").add(data).await()
            true
        } catch (_: Exception) {
            false
        }
    }

    fun observeAlerts(): Flow<List<FirestoreAlert>> = callbackFlow {
        val db = firestore
        if (db == null) {
            trySend(emptyList())
            awaitClose { }
            return@callbackFlow
        }

        val listener: ListenerRegistration = db.collection("emergency_alerts")
            .orderBy("timestamp", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(50)
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val alerts = snapshot.documents.mapNotNull { doc ->
                    try {
                        FirestoreAlert(
                            id = doc.id,
                            alertLevel = doc.getString("alertLevel") ?: "GREEN",
                            location = doc.getString("location") ?: "",
                            latitude = doc.getDouble("latitude") ?: 0.0,
                            longitude = doc.getDouble("longitude") ?: 0.0,
                            rainfallIntensity = doc.getDouble("rainfallIntensity") ?: 0.0,
                            floodDepth = doc.getDouble("floodDepth") ?: 0.0,
                            message = doc.getString("message") ?: "",
                            createdBy = doc.getString("createdBy") ?: "",
                            acknowledged = doc.getBoolean("acknowledged") ?: false
                        )
                    } catch (_: Exception) { null }
                }
                trySend(alerts)
            }

        awaitClose { listener.remove() }
    }

    // ── Responder Profile Operations ──

    suspend fun saveResponderProfile(profile: ResponderProfile): Boolean {
        return try {
            val db = firestore ?: return false
            db.collection("responder_profiles")
                .document(profile.uid)
                .set(profile)
                .await()
            true
        } catch (_: Exception) {
            false
        }
    }

    // ── Deployment Log Operations ──

    suspend fun logDeployment(log: DeploymentLog): Boolean {
        return try {
            val uid = auth?.currentUser?.uid ?: return false
            val db = firestore ?: return false
            val data = hashMapOf(
                "alertId" to log.alertId,
                "resourceType" to log.resourceType,
                "quantity" to log.quantity,
                "deployedTo" to log.deployedTo,
                "status" to log.status,
                "timestamp" to log.timestamp,
                "deployedBy" to uid
            )
            db.collection("deployment_logs").add(data).await()
            true
        } catch (_: Exception) {
            false
        }
    }

    // ── Inundation Scenario Operations ──

    suspend fun saveInundationScenario(scenario: FirestoreInundationScenario): Boolean {
        return try {
            val uid = auth?.currentUser?.uid ?: return false
            val db = firestore ?: return false
            val data = hashMapOf(
                "returnPeriod" to scenario.returnPeriod,
                "rainfallIntensity" to scenario.rainfallIntensity,
                "maxFloodDepth" to scenario.maxFloodDepth,
                "floodedArea" to scenario.floodedArea,
                "geoJsonExport" to scenario.geoJsonExport,
                "timestamp" to scenario.timestamp,
                "createdBy" to uid
            )
            db.collection("inundation_scenarios").add(data).await()
            true
        } catch (_: Exception) {
            false
        }
    }
}
