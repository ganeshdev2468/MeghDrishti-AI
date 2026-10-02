package com.meghdrishti.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.meghdrishti.ai.data.model.ImdAlertLevel
import com.meghdrishti.ai.ui.components.EmergencyAlertBanner
import com.meghdrishti.ai.ui.components.RadarScanCanvas
import com.meghdrishti.ai.ui.theme.*
import com.meghdrishti.ai.ui.viewmodel.MeghDrishtiViewModel

@Composable
fun RadarSatelliteScreen(
    viewModel: MeghDrishtiViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()

    val currentStation = state.stations.getOrNull(state.selectedStationIndex)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkNavy)
            .verticalScroll(scrollState)
            .padding(16.dp)
    ) {
        // Top Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "RADAR & SATELLITE DEMO",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color = CyanAccent
                )
                Text(
                    text = "Synthetic visualization · not a live DWR or INSAT feed",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondary
                )
            }
            IconButton(
                onClick = { viewModel.refreshAllTelemetry() },
                enabled = !state.isLoading
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Refresh Telemetry",
                    tint = CyanAccent
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "DEMO DATA · Radar sweep and satellite estimates are generated locally; station weather may use Open-Meteo or a simulated fallback.",
            style = MaterialTheme.typography.bodySmall,
            color = ImdYellow
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Station Selector Chips
        Text(
            text = "OBSERVATIONAL RADAR / AWS STATIONS",
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
            state.stations.forEachIndexed { index, station ->
                FilterChip(
                    selected = state.selectedStationIndex == index,
                    onClick = { viewModel.selectStation(index) },
                    label = {
                        Text(
                            text = station.name.split(" ").first(),
                            fontWeight = if (state.selectedStationIndex == index) FontWeight.Bold else FontWeight.Normal
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = CyanAccent,
                        selectedLabelColor = DarkNavy,
                        containerColor = DarkSurface,
                        labelColor = TextPrimary
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Alert Banner if rainfall high
        currentStation?.let { st ->
            EmergencyAlertBanner(
                alertLevel = st.alertLevel,
                location = st.name,
                message = "Precipitation rate: ${"%.1f".format(st.currentPrecipitation)} mm/hr | Wind: ${"%.1f".format(st.windSpeed)} km/h | Pressure: ${"%.1f".format(st.pressure)} hPa"
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Radar Scope Canvas Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            border = CardDefaults.outlinedCardBorder().let {
                androidx.compose.foundation.BorderStroke(1.dp, CyanAccent.copy(alpha = 0.3f))
            }
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "DOPPLER RADAR SWEEP (PPI)",
                        style = MaterialTheme.typography.titleSmall,
                        color = TealAccent,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "RANGE: 250 KM",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))

                state.radarScan?.let { radar ->
                    RadarScanCanvas(radarData = radar)
                } ?: Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(260.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = CyanAccent)
                }

                Spacer(modifier = Modifier.height(10.dp))

                // dBZ Reflectivity Scale Legend
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "dBZ:", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    listOf(
                        "5" to DbzLevel05,
                        "15" to DbzLevel15,
                        "25" to DbzLevel25,
                        "35" to DbzLevel35,
                        "45" to DbzLevel45,
                        "55" to DbzLevel55,
                        "65+" to DbzLevel65
                    ).forEach { (label, col) ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(col)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(text = label, style = MaterialTheme.typography.labelSmall, color = TextSecondary, fontSize = 10.sp)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // INSAT-3DR / 3DS Multi-Spectral Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface)
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(
                    text = "INSAT-3DR / 3DS SATELLITE TELEMETRY",
                    style = MaterialTheme.typography.titleSmall,
                    color = CyanAccent,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                state.satelliteObs?.let { sat ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(text = "TIR1 Brightness Temp", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                            Text(
                                text = "${"%.1f".format(sat.cloudTopTemp)} °C",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Black,
                                color = if (sat.cloudTopTemp < -50) ImdRed else CyanAccent
                            )
                        }
                        Column {
                            Text(text = "Water Vapor Flux", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                            Text(
                                text = "${"%.1f".format(sat.waterVaporFlux)} mm",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Black,
                                color = TealAccent
                            )
                        }
                        Column {
                            Text(text = "Hydro-Estimator QPE", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                            Text(
                                text = "${"%.1f".format(sat.hydroEstimatorQpe)} mm/h",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Black,
                                color = if (sat.hydroEstimatorQpe > 50) ImdOrange else TextPrimary
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
