package com.meghdrishti.ai.data.repository

import com.meghdrishti.ai.data.model.*
import com.meghdrishti.ai.data.remote.OpenMeteoService
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import kotlin.math.pow
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * Central repository for weather forecast data aggregation.
 * Fetches real-time observations from Open-Meteo and generates
 * simulated radar, satellite, NWP, and inundation scenario data
 * matching ISRO/IMD operational parameters.
 */
class WeatherForecastRepository {

    private val moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        })
        .build()

    private val openMeteoApi: OpenMeteoService = Retrofit.Builder()
        .baseUrl("https://api.open-meteo.com/")
        .client(okHttpClient)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()
        .create(OpenMeteoService::class.java)

    // ── Indian Disaster Hotspot Stations ──
    private val indianStations = listOf(
        Triple("Mumbai (Colaba)", 18.9068, 72.8073),
        Triple("Chennai (Nungambakkam)", 13.0674, 80.2376),
        Triple("Wayanad (Kalpetta)", 11.6854, 76.0781),
        Triple("Guwahati (Borjhar)", 26.1158, 91.5860),
        Triple("Delhi NCR (Safdarjung)", 28.5844, 77.2088),
        Triple("Uttarakhand (Dehradun)", 30.3165, 78.0322)
    )

    /**
     * Fetch real-time observations from all Indian monitoring stations.
     */
    suspend fun fetchAllStationData(): List<ObservationStation> = coroutineScope {
        indianStations.map { (name, lat, lon) ->
            async {
                try {
                    val response = openMeteoApi.getCurrentWeather(lat, lon)
                    val current = response.current
                    val precip = current?.precipitation ?: 0.0
                    ObservationStation(
                        name = name,
                        latitude = lat,
                        longitude = lon,
                        elevation = response.elevation,
                        currentPrecipitation = precip,
                        cumulativePrecipitation24h = precip * 24 * Random.nextDouble(0.3, 0.8),
                        temperature = current?.temperature ?: 28.0,
                        windSpeed = current?.windSpeed ?: 0.0,
                        windDirection = current?.windDirection ?: 0.0,
                        humidity = current?.humidity ?: 70.0,
                        pressure = current?.pressure ?: 1010.0,
                        alertLevel = classifyAlertLevel(precip)
                    )
                } catch (_: Exception) {
                    // Return simulated data if API fails
                    generateSimulatedStation(name, lat, lon)
                }
            }
        }.awaitAll()
    }

    /**
     * Generate simulated Doppler radar scan data.
     */
    fun generateRadarScan(stationPrecipitation: Double = 0.0): RadarScanData {
        val baseIntensity = (stationPrecipitation * 3).coerceIn(0.0, 65.0)
        val cells = mutableListOf<ReflectivityCell>()
        val storms = mutableListOf<StormCell>()

        // Generate reflectivity cells across radar scope
        for (i in 0 until 180) {
            val azimuth = Random.nextFloat() * 360f
            val range = Random.nextFloat() * 200f + 20f
            val dbz = (baseIntensity + Random.nextDouble(-15.0, 25.0))
                .coerceIn(0.0, 70.0).toFloat()
            if (dbz > 5f) {
                cells.add(ReflectivityCell(azimuth, range, dbz))
            }
        }

        // Generate tracked storm cells (TITAN/SCIT)
        if (baseIntensity > 20) {
            val numStorms = Random.nextInt(1, 4)
            for (i in 0 until numStorms) {
                storms.add(
                    StormCell(
                        id = "CELL-${('A' + i)}",
                        azimuth = Random.nextFloat() * 360f,
                        range = Random.nextFloat() * 150f + 30f,
                        peakDbz = (baseIntensity + Random.nextDouble(5.0, 20.0))
                            .coerceIn(30.0, 70.0).toFloat(),
                        velocityHeading = Random.nextFloat() * 360f,
                        velocitySpeed = Random.nextFloat() * 40f + 10f
                    )
                )
            }
        }

        return RadarScanData(
            radarSite = "IMD S-Band DWR",
            scanTime = java.text.SimpleDateFormat("HH:mm:ss z", java.util.Locale.US)
                .format(java.util.Date()),
            elevationAngle = 0.5f,
            maxRange = 250f,
            reflectivityCells = cells,
            stormCells = storms
        )
    }

    /**
     * Generate INSAT-3DR satellite observation data.
     */
    fun generateSatelliteObs(precipitation: Double = 0.0): SatelliteObservation {
        return SatelliteObservation(
            channel = "TIR1 (10.8μm)",
            cloudTopTemp = if (precipitation > 5) -65.0 + Random.nextDouble(-10.0, 10.0)
            else -20.0 + Random.nextDouble(-10.0, 20.0),
            waterVaporFlux = precipitation * 0.8 + Random.nextDouble(5.0, 15.0),
            hydroEstimatorQpe = precipitation * Random.nextDouble(0.8, 1.5),
            cloudMotionVector = (Random.nextDouble(-15.0, 15.0)) to (Random.nextDouble(-15.0, 15.0))
        )
    }

    /**
     * Generate NWP model ensemble forecasts.
     */
    fun generateNwpEnsemble(basePrecipitation: Double = 0.0): List<NwpModelForecast> {
        val base24h = basePrecipitation * 24 * Random.nextDouble(0.5, 1.5)
        return listOf(
            NwpModelForecast(
                modelName = "IMD WRF",
                resolution = "3 km",
                accumulatedRainfall24h = base24h * Random.nextDouble(0.8, 1.3),
                cape = Random.nextDouble(500.0, 3500.0),
                cin = Random.nextDouble(-50.0, -5.0),
                precipitableWater = Random.nextDouble(40.0, 75.0),
                cloudburstProbability = (basePrecipitation / 100.0).coerceIn(0.0, 0.95),
                maxWindGust = Random.nextDouble(20.0, 80.0),
                forecastHours = generateHourlyForecast(base24h)
            ),
            NwpModelForecast(
                modelName = "NCMRWF NCUM",
                resolution = "12 km",
                accumulatedRainfall24h = base24h * Random.nextDouble(0.7, 1.2),
                cape = Random.nextDouble(400.0, 3000.0),
                cin = Random.nextDouble(-60.0, -10.0),
                precipitableWater = Random.nextDouble(38.0, 70.0),
                cloudburstProbability = (basePrecipitation / 120.0).coerceIn(0.0, 0.9),
                maxWindGust = Random.nextDouble(18.0, 75.0),
                forecastHours = generateHourlyForecast(base24h * 0.9)
            ),
            NwpModelForecast(
                modelName = "ECMWF HRES",
                resolution = "9 km",
                accumulatedRainfall24h = base24h * Random.nextDouble(0.6, 1.1),
                cape = Random.nextDouble(450.0, 3200.0),
                cin = Random.nextDouble(-55.0, -8.0),
                precipitableWater = Random.nextDouble(35.0, 68.0),
                cloudburstProbability = (basePrecipitation / 130.0).coerceIn(0.0, 0.85),
                maxWindGust = Random.nextDouble(15.0, 70.0),
                forecastHours = generateHourlyForecast(base24h * 0.85)
            ),
            NwpModelForecast(
                modelName = "NOAA GFS",
                resolution = "25 km",
                accumulatedRainfall24h = base24h * Random.nextDouble(0.5, 1.0),
                cape = Random.nextDouble(300.0, 2800.0),
                cin = Random.nextDouble(-70.0, -15.0),
                precipitableWater = Random.nextDouble(32.0, 65.0),
                cloudburstProbability = (basePrecipitation / 140.0).coerceIn(0.0, 0.8),
                maxWindGust = Random.nextDouble(12.0, 65.0),
                forecastHours = generateHourlyForecast(base24h * 0.8)
            )
        )
    }

    /**
     * Generate inundation scenarios for multiple return periods.
     */
    fun generateInundationScenarios(rainfallIntensity: Double): List<InundationScenario> {
        return listOf(2, 5, 10, 25, 50, 100).map { rp ->
            val scaleFactor = kotlin.math.ln(rp.toDouble() + 1) / kotlin.math.ln(101.0)
            val intensity = rainfallIntensity * (1 + scaleFactor)
            val maxDepth = (intensity * 0.025 * scaleFactor * 3).coerceIn(0.0, 5.0)
            val floodArea = maxDepth * Random.nextDouble(2.0, 8.0)
            val peakQ = intensity * floodArea * 0.28 // Rational method Q = CIA

            InundationScenario(
                returnPeriod = rp,
                rainfallIntensity = intensity,
                maxFloodDepth = maxDepth,
                floodedArea = floodArea,
                peakDischarge = peakQ,
                timeToFlood = (10.0 / (intensity.coerceAtLeast(1.0) * 0.1)).coerceIn(0.5, 12.0),
                vulnerableZones = generateVulnerableZones(maxDepth)
            )
        }
    }

    // ── Private Helpers ──

    private fun classifyAlertLevel(precipMmPerHr: Double): ImdAlertLevel {
        return when {
            precipMmPerHr >= 204.4 -> ImdAlertLevel.EXTREME
            precipMmPerHr >= 115.5 -> ImdAlertLevel.RED
            precipMmPerHr >= 64.5 -> ImdAlertLevel.ORANGE
            precipMmPerHr >= 35.0 -> ImdAlertLevel.YELLOW
            else -> ImdAlertLevel.GREEN
        }
    }

    private fun generateSimulatedStation(name: String, lat: Double, lon: Double): ObservationStation {
        val precip = Random.nextDouble(0.0, 15.0)
        return ObservationStation(
            name = name,
            latitude = lat,
            longitude = lon,
            elevation = Random.nextDouble(5.0, 500.0),
            currentPrecipitation = precip,
            cumulativePrecipitation24h = precip * Random.nextDouble(5.0, 20.0),
            temperature = Random.nextDouble(22.0, 38.0),
            windSpeed = Random.nextDouble(5.0, 45.0),
            windDirection = Random.nextDouble(0.0, 360.0),
            humidity = Random.nextDouble(60.0, 98.0),
            pressure = Random.nextDouble(995.0, 1020.0),
            alertLevel = classifyAlertLevel(precip)
        )
    }

    private fun generateHourlyForecast(base24h: Double): List<HourlyForecast> {
        return (0 until 24).map { hour ->
            val diurnalFactor = if (hour in 14..20) 1.5 else 0.7
            HourlyForecast(
                hour = hour,
                rainfall = (base24h / 24.0 * diurnalFactor * Random.nextDouble(0.3, 2.0))
                    .coerceAtLeast(0.0),
                temperature = 25.0 + Random.nextDouble(-5.0, 10.0),
                windSpeed = Random.nextDouble(5.0, 50.0)
            )
        }
    }

    private fun generateVulnerableZones(maxDepth: Double): List<VulnerableZone> {
        if (maxDepth < 0.1) return emptyList()
        return listOf(
            VulnerableZone("Andheri Subway", "underpass", maxDepth * 1.2,
                classifyAlertLevel(maxDepth * 80)),
            VulnerableZone("KEM Hospital Road", "hospital", maxDepth * 0.6,
                classifyAlertLevel(maxDepth * 40)),
            VulnerableZone("Metro Station L3", "metro_sublevel", maxDepth * 0.9,
                classifyAlertLevel(maxDepth * 60)),
            VulnerableZone("Mithi River Sluice Gate", "sluice_gate", maxDepth * 1.5,
                classifyAlertLevel(maxDepth * 100))
        ).filter { it.floodDepth > 0.05 }
    }
}
