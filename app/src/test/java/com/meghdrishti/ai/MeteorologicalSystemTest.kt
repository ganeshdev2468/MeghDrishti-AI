package com.meghdrishti.ai

import com.meghdrishti.ai.data.model.ImdAlertLevel
import com.meghdrishti.ai.data.repository.WeatherForecastRepository
import com.meghdrishti.ai.util.GisExportHelper
import org.junit.Assert.*
import org.junit.Test

class MeteorologicalSystemTest {

    private val repository = WeatherForecastRepository()

    @Test
    fun testImdAlertLevelThresholds() {
        assertEquals(0.0, ImdAlertLevel.GREEN.thresholdMmPerHr, 0.01)
        assertEquals(35.0, ImdAlertLevel.YELLOW.thresholdMmPerHr, 0.01)
        assertEquals(64.5, ImdAlertLevel.ORANGE.thresholdMmPerHr, 0.01)
        assertEquals(115.5, ImdAlertLevel.RED.thresholdMmPerHr, 0.01)
        assertEquals(204.4, ImdAlertLevel.EXTREME.thresholdMmPerHr, 0.01)
    }

    @Test
    fun testInundationScenariosGeneration() {
        val scenarios = repository.generateInundationScenarios(75.0)
        assertEquals(6, scenarios.size) // 2, 5, 10, 25, 50, 100 yrs
        assertTrue(scenarios.first().maxFloodDepth <= scenarios.last().maxFloodDepth)
    }

    @Test
    fun testGeoJsonExportFormat() {
        val scenarios = repository.generateInundationScenarios(100.0)
        val geoJson = GisExportHelper.exportToGeoJson(scenarios, 14.4426, 79.9865)
        assertTrue(geoJson.contains("FeatureCollection"))
        assertTrue(geoJson.contains("return_period_years"))
        assertTrue(geoJson.contains("EPSG::4326"))
    }
}
