package com.meghdrishti.ai.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.meghdrishti.ai.data.model.ImdAlertLevel
import com.meghdrishti.ai.ui.components.GisInundationMapCanvas
import com.meghdrishti.ai.ui.components.TopographicalInundationCanvas
import com.meghdrishti.ai.ui.theme.*
import com.meghdrishti.ai.ui.viewmodel.MeghDrishtiViewModel

@Composable
fun InundationScreen(
    viewModel: MeghDrishtiViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    val returnPeriods = listOf(2, 5, 10, 25, 50, 100)
    val selectedScenario = state.inundationScenarios.getOrNull(state.selectedReturnPeriodIndex)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkNavy)
            .verticalScroll(scrollState)
            .padding(16.dp)
    ) {
        // Screen Header
        Text(
            text = "INUNDATION SCENARIO DEMO",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color = CyanAccent
        )
        Text(
            text = "Simplified rainfall stress test · no live DEM or hydraulic model input",
            style = MaterialTheme.typography.labelSmall,
            color = TextSecondary
        )

        Spacer(modifier = Modifier.height(14.dp))

        Text(
            text = "SIMULATION ONLY · Flood extents and depths are illustrative, not a geospatial forecast or evacuation boundary.",
            style = MaterialTheme.typography.bodySmall,
            color = ImdYellow
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Precipitation Stress-Test Slider Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface)
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "PRECIPITATION STRESS-TEST",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = TealAccent
                    )
                    Text(
                        text = "${state.simulationRainfallSlider.toInt()} mm/hr",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black,
                        color = if (state.simulationRainfallSlider > 100) ImdRed else CyanAccent
                    )
                }

                Slider(
                    value = state.simulationRainfallSlider,
                    onValueChange = { viewModel.setSimulationRainfall(it) },
                    valueRange = 10f..250f,
                    colors = SliderDefaults.colors(
                        thumbColor = CyanAccent,
                        activeTrackColor = CyanAccent,
                        inactiveTrackColor = DarkCard
                    )
                )

                // Quick presets
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    listOf(
                        "Light (25)" to 25f,
                        "Heavy (65)" to 65f,
                        "V. Heavy (115)" to 115f,
                        "Cloudburst (200)" to 200f
                    ).forEach { (lbl, valMm) ->
                        OutlinedButton(
                            onClick = { viewModel.setSimulationRainfall(valMm) },
                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(text = lbl, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Topographical Cross-Section Canvas
        Text(
            text = "CARTO-DEM ELEVATION & RUNOFF CHOKE-POINTS",
            style = MaterialTheme.typography.labelSmall,
            color = TextMuted,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(6.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface)
        ) {
            Column(modifier = Modifier.padding(10.dp)) {
                TopographicalInundationCanvas(rainfallIntensity = state.simulationRainfallSlider)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Return Period Selector
        Text(
            text = "RETURN PERIOD SCENARIO (YEARS)",
            style = MaterialTheme.typography.labelSmall,
            color = TextMuted,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(6.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            returnPeriods.forEachIndexed { index, rp ->
                FilterChip(
                    selected = state.selectedReturnPeriodIndex == index,
                    onClick = { viewModel.selectReturnPeriod(index) },
                    label = {
                        Text(
                            text = "T = $rp Yrs",
                            fontWeight = if (state.selectedReturnPeriodIndex == index) FontWeight.Bold else FontWeight.Normal
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = TealAccent,
                        selectedLabelColor = DarkNavy,
                        containerColor = DarkSurface,
                        labelColor = TextPrimary
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Inundation Stats Summary Card
        selectedScenario?.let { sc ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = DarkSurface)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Max Flood Depth", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(
                            text = "${"%.2f".format(sc.maxFloodDepth)} m",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            color = if (sc.maxFloodDepth > 1.0) ImdRed else CyanAccent
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Flooded Area", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(
                            text = "${"%.1f".format(sc.floodedArea)} km²",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            color = TealAccent
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Peak Runoff Q", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(
                            text = "${"%.0f".format(sc.peakDischarge)} m³/s",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            color = ImdOrange
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(14.dp))
        }

        // 2D GIS Inundation Map Canvas
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            border = CardDefaults.outlinedCardBorder().let {
                androidx.compose.foundation.BorderStroke(1.dp, TealAccent.copy(alpha = 0.3f))
            }
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "GIS FLOOD EXTENT MAP (WGS84)",
                        style = MaterialTheme.typography.titleSmall,
                        color = TealAccent,
                        fontWeight = FontWeight.Bold
                    )
                    Button(
                        onClick = {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("MeghDrishti GeoJSON", state.latestGeoJson))
                            Toast.makeText(context, "GeoJSON copied to clipboard for QGIS/Bhuvan!", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = DarkElevated)
                    ) {
                        Icon(imageVector = Icons.Default.ContentCopy, contentDescription = "Copy GeoJSON", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = "Export GeoJSON", style = MaterialTheme.typography.labelSmall)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                GisInundationMapCanvas(scenario = selectedScenario)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
