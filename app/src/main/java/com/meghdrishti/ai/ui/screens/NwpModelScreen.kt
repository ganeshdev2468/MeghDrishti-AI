package com.meghdrishti.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.meghdrishti.ai.data.model.NwpModelForecast
import com.meghdrishti.ai.ui.theme.*
import com.meghdrishti.ai.ui.viewmodel.MeghDrishtiViewModel

@Composable
fun NwpModelScreen(
    viewModel: MeghDrishtiViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkNavy)
            .verticalScroll(scrollState)
            .padding(16.dp)
    ) {
        // Header
        Text(
            text = "NWP SCENARIO DEMO",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color = CyanAccent
        )
        Text(
            text = "Illustrative fields · not ingested forecasts from the named models",
            style = MaterialTheme.typography.labelSmall,
            color = TextSecondary
        )

        Spacer(modifier = Modifier.height(14.dp))

        Text(
            text = "SIMULATED DATA · Model values are randomized examples and must not guide operational decisions.",
            style = MaterialTheme.typography.bodySmall,
            color = ImdYellow
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Ensemble Overview Banner
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface)
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(
                    text = "ENSEMBLE CONSENSUS ANALYSIS",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = TealAccent
                )
                Spacer(modifier = Modifier.height(8.dp))
                val avgRainfall = if (state.nwpModels.isNotEmpty()) {
                    state.nwpModels.map { it.accumulatedRainfall24h }.average()
                } else 0.0

                val maxCape = state.nwpModels.maxOfOrNull { it.cape } ?: 0.0
                val avgPwat = if (state.nwpModels.isNotEmpty()) {
                    state.nwpModels.map { it.precipitableWater }.average()
                } else 0.0

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(text = "Ensemble 24h Mean", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(
                            text = "${"%.1f".format(avgRainfall)} mm",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            color = CyanAccent
                        )
                    }
                    Column {
                        Text(text = "Peak CAPE Energy", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(
                            text = "${maxCape.toInt()} J/kg",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            color = if (maxCape > 2500) ImdRed else ImdOrange
                        )
                    }
                    Column {
                        Text(text = "Precipitable Water", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(
                            text = "${"%.1f".format(avgPwat)} mm",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            color = TealAccent
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Individual Model Cards
        state.nwpModels.forEach { model ->
            NwpModelCard(model = model)
            Spacer(modifier = Modifier.height(12.dp))
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
fun NwpModelCard(model: NwpModelForecast) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        border = CardDefaults.outlinedCardBorder().let {
            androidx.compose.foundation.BorderStroke(
                1.dp,
                if (model.modelName.contains("WRF")) CyanAccent.copy(alpha = 0.4f)
                else DarkElevated
            )
        }
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Model Title and Resolution
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .background(
                                if (model.modelName.contains("IMD")) CyanAccent
                                else if (model.modelName.contains("NCMRWF")) TealAccent
                                else if (model.modelName.contains("ECMWF")) IndigoAccent
                                else BlueAccent
                            )
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = model.modelName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                }
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = DarkElevated
                ) {
                    Text(
                        text = model.resolution,
                        style = MaterialTheme.typography.labelSmall,
                        color = CyanAccent,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Forecast Metrics Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(text = "24h Accumulated", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Text(
                        text = "${"%.1f".format(model.accumulatedRainfall24h)} mm",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (model.accumulatedRainfall24h > 100) ImdRed else CyanAccent
                    )
                }
                Column {
                    Text(text = "CAPE (Convection)", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Text(
                        text = "${model.cape.toInt()} J/kg",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (model.cape > 2500) ImdRed else TextPrimary
                    )
                }
                Column {
                    Text(text = "PWAT (Moisture)", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Text(
                        text = "${"%.1f".format(model.precipitableWater)} mm",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = TealAccent
                    )
                }
                Column {
                    Text(text = "Cloudburst Risk", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Text(
                        text = "${(model.cloudburstProbability * 100).toInt()}%",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (model.cloudburstProbability > 0.6) ImdRed else ImdGreen
                    )
                }
            }
        }
    }
}
