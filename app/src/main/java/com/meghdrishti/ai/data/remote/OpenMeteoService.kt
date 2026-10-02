package com.meghdrishti.ai.data.remote

import com.meghdrishti.ai.data.model.OpenMeteoResponse
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Open-Meteo API service for real-time weather observations.
 * Free, no API key required. Used for live station telemetry across India.
 */
interface OpenMeteoService {

    @GET("v1/forecast")
    suspend fun getCurrentWeather(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("current") current: String = "temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,wind_direction_10m,surface_pressure",
        @Query("timezone") timezone: String = "Asia/Kolkata"
    ): OpenMeteoResponse
}
