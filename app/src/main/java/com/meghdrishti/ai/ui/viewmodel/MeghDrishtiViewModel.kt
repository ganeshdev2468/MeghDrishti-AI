package com.meghdrishti.ai.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseUser
import com.meghdrishti.ai.data.local.AlertEntity
import com.meghdrishti.ai.data.local.MeghDrishtiDatabase
import com.meghdrishti.ai.data.model.*
import com.meghdrishti.ai.data.remote.GeminiScientificService
import com.meghdrishti.ai.data.repository.FirestoreEmergencyRepository
import com.meghdrishti.ai.data.repository.WeatherForecastRepository
import com.meghdrishti.ai.util.AuthHelper
import com.meghdrishti.ai.util.EmergencyNotificationHelper
import com.meghdrishti.ai.util.GisExportHelper
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class MeghDrishtiUiState(
    val isLoading: Boolean = false,
    val stations: List<ObservationStation> = emptyList(),
    val selectedStationIndex: Int = 0,
    val radarScan: RadarScanData? = null,
    val satelliteObs: SatelliteObservation? = null,
    val nwpModels: List<NwpModelForecast> = emptyList(),
    val inundationScenarios: List<InundationScenario> = emptyList(),
    val selectedReturnPeriodIndex: Int = 2, // default 10-year
    val simulationRainfallSlider: Float = 65f, // mm/hr
    val localAlerts: List<AlertEntity> = emptyList(),
    val cloudAlerts: List<FirestoreAlert> = emptyList(),
    val aiAdvisory: String = "",
    val isAiGenerating: Boolean = false,
    val currentUser: FirebaseUser? = null,
    val authError: String? = null,
    val unreadCriticalAlerts: Int = 0,
    val latestGeoJson: String = ""
)

class MeghDrishtiViewModel(application: Application) : AndroidViewModel(application) {

    private val weatherRepo = WeatherForecastRepository()
    private val firestoreRepo = FirestoreEmergencyRepository()
    private val geminiService = GeminiScientificService()
    private val database = MeghDrishtiDatabase.getInstance(application)
    private val notificationHelper = EmergencyNotificationHelper(application)
    val authHelper = AuthHelper(application)

    private val _uiState = MutableStateFlow(MeghDrishtiUiState())
    val uiState: StateFlow<MeghDrishtiUiState> = _uiState.asStateFlow()

    init {
        checkCurrentUser()
        refreshAllTelemetry()
        observeLocalAlerts()
        observeCloudAlerts()
    }

    fun checkCurrentUser() {
        _uiState.update { it.copy(currentUser = authHelper.getCurrentUser()) }
    }

    fun selectStation(index: Int) {
        val currentStations = _uiState.value.stations
        if (index in currentStations.indices) {
            _uiState.update { it.copy(selectedStationIndex = index) }
            val station = currentStations[index]
            updateObservationalData(station.currentPrecipitation, station.latitude, station.longitude)
        }
    }

    fun setSimulationRainfall(rainfallMmHr: Float) {
        _uiState.update { it.copy(simulationRainfallSlider = rainfallMmHr) }
        val currentStation = _uiState.value.stations.getOrNull(_uiState.value.selectedStationIndex)
        val lat = currentStation?.latitude ?: 18.9068
        val lon = currentStation?.longitude ?: 72.8073
        val scenarios = weatherRepo.generateInundationScenarios(rainfallMmHr.toDouble())
        val geoJson = GisExportHelper.exportToGeoJson(scenarios, lat, lon)
        _uiState.update {
            it.copy(
                inundationScenarios = scenarios,
                latestGeoJson = geoJson
            )
        }
    }

    fun selectReturnPeriod(index: Int) {
        _uiState.update { it.copy(selectedReturnPeriodIndex = index) }
    }

    fun refreshAllTelemetry() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val stations = weatherRepo.fetchAllStationData()
                _uiState.update { it.copy(stations = stations) }

                val selected = stations.getOrNull(_uiState.value.selectedStationIndex) ?: stations.firstOrNull()
                val precip = selected?.currentPrecipitation ?: 45.0
                val lat = selected?.latitude ?: 18.9068
                val lon = selected?.longitude ?: 72.8073

                updateObservationalData(precip, lat, lon)
            } catch (_: Exception) {
                // Keep existing telemetry if network fails
            } finally {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    private fun updateObservationalData(precip: Double, lat: Double, lon: Double) {
        val radar = weatherRepo.generateRadarScan(precip)
        val sat = weatherRepo.generateSatelliteObs(precip)
        val nwp = weatherRepo.generateNwpEnsemble(precip)
        val sliderVal = _uiState.value.simulationRainfallSlider.toDouble().coerceAtLeast(precip)
        val scenarios = weatherRepo.generateInundationScenarios(sliderVal)
        val geoJson = GisExportHelper.exportToGeoJson(scenarios, lat, lon)

        _uiState.update {
            it.copy(
                radarScan = radar,
                satelliteObs = sat,
                nwpModels = nwp,
                inundationScenarios = scenarios,
                latestGeoJson = geoJson
            )
        }
    }

    fun dispatchDrillAlert(alertLevel: ImdAlertLevel, location: String, message: String) {
        viewModelScope.launch {
            val station = _uiState.value.stations.getOrNull(_uiState.value.selectedStationIndex)
            val lat = station?.latitude ?: 18.9068
            val lon = station?.longitude ?: 72.8073
            val precip = _uiState.value.simulationRainfallSlider.toDouble()
            val floodDepth = _uiState.value.inundationScenarios.getOrNull(_uiState.value.selectedReturnPeriodIndex)?.maxFloodDepth ?: 0.5
            val capXml = notificationHelper.generateCapXml(alertLevel, location, lat, lon, message)

            // 1. Dispatch Android heads-up notification with siren/vibration
            notificationHelper.dispatchAlert(alertLevel, "LOCAL SCENARIO DRILL", message, location)

            // 2. Persist locally to Room DB
            val entity = AlertEntity(
                alertLevel = alertLevel.name,
                location = location,
                latitude = lat,
                longitude = lon,
                rainfallIntensity = precip,
                floodDepth = floodDepth,
                message = message,
                notificationSent = true,
                capXml = capXml
            )
            database.alertDao().insertAlert(entity)

            // 3. Publish to Firestore cloud channel
            val firestoreAlert = FirestoreAlert(
                alertLevel = alertLevel.name,
                location = location,
                latitude = lat,
                longitude = lon,
                rainfallIntensity = precip,
                floodDepth = floodDepth,
                message = message,
                capXml = capXml,
                timestamp = Timestamp.now()
            )
            firestoreRepo.publishAlert(firestoreAlert)
        }
    }

    fun generateAiAdvisory() {
        viewModelScope.launch {
            _uiState.update { it.copy(isAiGenerating = true) }
            val station = _uiState.value.stations.getOrNull(_uiState.value.selectedStationIndex)
            val stationName = station?.name ?: "Mumbai (Colaba)"
            val precip = station?.currentPrecipitation ?: 0.0
            val wind = station?.windSpeed ?: 0.0
            val temp = station?.temperature ?: 28.0
            val radar = _uiState.value.radarScan
            val sat = _uiState.value.satelliteObs
            val inundation = _uiState.value.inundationScenarios.getOrNull(_uiState.value.selectedReturnPeriodIndex)

            val contextData = """
STATION: $stationName
COORDINATES: ${station?.latitude}, ${station?.longitude}
CURRENT PRECIPITATION: $precip mm/hr
WIND SPEED: $wind km/h
SURFACE TEMP: $temp °C
SATELLITE TIR BRIGHTNESS TEMP: ${sat?.cloudTopTemp} °C
QPE ESTIMATE: ${sat?.hydroEstimatorQpe} mm/hr
RADAR DETECTED STORMS: ${radar?.stormCells?.size ?: 0} cells
MAX RADAR REFLECTIVITY: ${radar?.stormCells?.maxOfOrNull { it.peakDbz } ?: 35f} dBZ
SIMULATED FLOOD DEPTH: ${inundation?.maxFloodDepth ?: 0.0} m
PREDICTED PEAK RUNOFF: ${inundation?.peakDischarge ?: 0.0} m³/s
RETURN PERIOD: ${inundation?.returnPeriod ?: 10} Years
            """.trimIndent()

            val advisory = geminiService.generateAdvisory(contextData)
            _uiState.update {
                it.copy(
                    aiAdvisory = advisory,
                    isAiGenerating = false
                )
            }
        }
    }

    fun acknowledgeAlert(alertId: Long) {
        viewModelScope.launch {
            database.alertDao().acknowledgeAlert(alertId)
        }
    }

    private fun observeLocalAlerts() {
        viewModelScope.launch {
            database.alertDao().getRecentAlerts(50).collect { alerts ->
                _uiState.update { it.copy(localAlerts = alerts) }
            }
        }
        viewModelScope.launch {
            database.alertDao().getUnacknowledgedCriticalCount().collect { count ->
                _uiState.update { it.copy(unreadCriticalAlerts = count) }
            }
        }
    }

    private fun observeCloudAlerts() {
        viewModelScope.launch {
            firestoreRepo.observeAlerts().collect { alerts ->
                _uiState.update { it.copy(cloudAlerts = alerts) }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            authHelper.signOut()
            _uiState.update { it.copy(currentUser = null) }
        }
    }
}
