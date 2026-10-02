package com.meghdrishti.ai.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ═══════════════════════════════════════════════════════════
// Meteorological Data Models — ISRO/IMD Operational Standards
// ═══════════════════════════════════════════════════════════

/**
 * IMD Alert Severity Levels per IMD Colour Code Warning System.
 */
enum class ImdAlertLevel(val label: String, val thresholdMmPerHr: Double) {
    GREEN("No Warning", 0.0),
    YELLOW("Watch", 35.0),
    ORANGE("Alert", 64.5),
    RED("Warning", 115.5),
    EXTREME("Cloudburst / Catastrophe", 204.4)
}

/**
 * Represents a monitoring station with real-time observational data.
 */
data class ObservationStation(
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val elevation: Double = 0.0,
    val currentPrecipitation: Double = 0.0,    // mm/hr
    val cumulativePrecipitation24h: Double = 0.0, // mm
    val temperature: Double = 0.0,              // °C
    val windSpeed: Double = 0.0,                // km/h
    val windDirection: Double = 0.0,            // degrees
    val humidity: Double = 0.0,                 // %
    val pressure: Double = 0.0,                 // hPa
    val alertLevel: ImdAlertLevel = ImdAlertLevel.GREEN
)

/**
 * NWP Model forecast data for ensemble comparison.
 */
data class NwpModelForecast(
    val modelName: String,               // e.g. "IMD WRF 3km", "NCMRWF NCUM 12km"
    val resolution: String,              // e.g. "3 km"
    val accumulatedRainfall24h: Double,   // mm
    val cape: Double = 0.0,              // J/kg — Convective Available Potential Energy
    val cin: Double = 0.0,               // J/kg — Convective Inhibition
    val precipitableWater: Double = 0.0, // mm — PWAT
    val cloudburstProbability: Double = 0.0, // 0.0–1.0
    val maxWindGust: Double = 0.0,       // km/h
    val forecastHours: List<HourlyForecast> = emptyList()
)

data class HourlyForecast(
    val hour: Int,
    val rainfall: Double,    // mm
    val temperature: Double, // °C
    val windSpeed: Double    // km/h
)

/**
 * Radar scan data representing a single DWR sweep.
 */
data class RadarScanData(
    val radarSite: String,
    val scanTime: String,
    val elevationAngle: Float,         // degrees
    val maxRange: Float,               // km
    val reflectivityCells: List<ReflectivityCell> = emptyList(),
    val stormCells: List<StormCell> = emptyList()
)

data class ReflectivityCell(
    val azimuth: Float,    // 0–360 degrees
    val range: Float,      // km from radar
    val dbzValue: Float    // dBZ reflectivity
)

data class StormCell(
    val id: String,
    val azimuth: Float,
    val range: Float,
    val peakDbz: Float,
    val velocityHeading: Float, // degrees, direction of movement
    val velocitySpeed: Float    // km/h
)

/**
 * INSAT-3DR/3DS satellite observation parameters.
 */
data class SatelliteObservation(
    val channel: String,                   // "TIR1", "WV", "VIS"
    val cloudTopTemp: Double = 0.0,        // °C (Brightness Temperature)
    val waterVaporFlux: Double = 0.0,      // mm
    val hydroEstimatorQpe: Double = 0.0,   // mm/hr — Satellite QPE
    val cloudMotionVector: Pair<Double, Double> = 0.0 to 0.0 // u,v m/s
)

/**
 * Inundation scenario from hydrodynamic simulation.
 */
data class InundationScenario(
    val returnPeriod: Int,                  // years (2, 5, 10, 25, 50, 100)
    val rainfallIntensity: Double,          // mm/hr input
    val maxFloodDepth: Double,              // meters
    val floodedArea: Double,                // sq km
    val peakDischarge: Double,              // m³/s
    val timeToFlood: Double,               // hours
    val vulnerableZones: List<VulnerableZone> = emptyList()
)

data class VulnerableZone(
    val name: String,
    val type: String,       // "metro_sublevel", "hospital", "underpass", "sluice_gate"
    val floodDepth: Double, // m
    val riskLevel: ImdAlertLevel
)

// ─── Open-Meteo API Response Models ───

@JsonClass(generateAdapter = true)
data class OpenMeteoResponse(
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val elevation: Double = 0.0,
    @Json(name = "current") val current: OpenMeteoCurrent? = null
)

@JsonClass(generateAdapter = true)
data class OpenMeteoCurrent(
    val time: String = "",
    @Json(name = "temperature_2m") val temperature: Double = 0.0,
    @Json(name = "relative_humidity_2m") val humidity: Double = 0.0,
    @Json(name = "precipitation") val precipitation: Double = 0.0,
    @Json(name = "rain") val rain: Double = 0.0,
    @Json(name = "wind_speed_10m") val windSpeed: Double = 0.0,
    @Json(name = "wind_direction_10m") val windDirection: Double = 0.0,
    @Json(name = "surface_pressure") val pressure: Double = 0.0
)
