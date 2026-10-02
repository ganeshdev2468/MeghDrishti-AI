package com.meghdrishti.ai.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.meghdrishti.ai.data.local.AlertEntity
import com.meghdrishti.ai.data.model.ImdAlertLevel
import com.meghdrishti.ai.ui.theme.*
import com.meghdrishti.ai.ui.viewmodel.MeghDrishtiViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun EmergencyResponseScreen(
    viewModel: MeghDrishtiViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    val currentStation = state.stations.getOrNull(state.selectedStationIndex)
    val stationName = currentStation?.name ?: "Mumbai (Colaba)"

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkNavy)
            .padding(16.dp)
    ) {
        // Header
        Text(
            text = "ALERT DRILL CONSOLE",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color = CyanAccent
        )
        Text(
            text = "Local notification and audit-log test; no agency or public broadcast",
            style = MaterialTheme.typography.labelSmall,
            color = TextSecondary
        )

        Spacer(modifier = Modifier.height(14.dp))

        Text(
            text = "DRILL MODE · Scenario data is simulated. Creates a test notification and audit record only; no public or agency broadcast.",
            style = MaterialTheme.typography.bodySmall,
            color = ImdYellow
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Quick Manual Alert Escalation Trigger Panel
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            border = CardDefaults.outlinedCardBorder().let {
                androidx.compose.foundation.BorderStroke(1.dp, ImdRed.copy(alpha = 0.5f))
            }
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "RUN LOCAL ALERT DRILL ($stationName)",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = ImdOrange
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            viewModel.dispatchDrillAlert(
                                ImdAlertLevel.YELLOW,
                                stationName,
                                "Scenario drill: isolated heavy showers expected. Check official forecasts for current guidance."
                            )
                            Toast.makeText(context, "Local advisory drill recorded", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = ImdYellow)
                    ) {
                        Text("Tier 1\nWatch", color = DarkNavy, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            viewModel.dispatchDrillAlert(
                                ImdAlertLevel.ORANGE,
                                stationName,
                                "Scenario drill: very heavy rainfall and possible waterlogging. Check official forecasts for current guidance."
                            )
                            Toast.makeText(context, "Local warning drill recorded", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = ImdOrange)
                    ) {
                        Text("Tier 2\nAlert", color = DarkNavy, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            viewModel.dispatchDrillAlert(
                                ImdAlertLevel.RED,
                                stationName,
                                "Scenario drill: extreme rainfall and possible flash flooding. Check official warnings and local response guidance."
                            )
                            Toast.makeText(context, "Local critical drill recorded", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = ImdRed)
                    ) {
                        Text("Tier 3\nRed Siren", color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Agency Logistics Deployment Status
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface)
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(
                    text = "CIVIL DEFENSE RESOURCE TRACKER",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = TealAccent
                )
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "NDRF Battalions", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(text = "4 Deployed", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = CyanAccent)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Rescue Boats", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(text = "18 Active", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = TealAccent)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Dewatering Pumps", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(text = "42 Online", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = ImdOrange)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Relief Shelters", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(text = "12 Open", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = TextPrimary)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Dispatched Alerts Audit History (Local Room DB)
        Text(
            text = "DISPATCH AUDIT LOG (${state.localAlerts.size} Records)",
            style = MaterialTheme.typography.labelSmall,
            color = TextMuted,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(
            modifier = Modifier.fillMaxWidth().weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(state.localAlerts) { alert ->
                AlertHistoryItem(alert = alert, onAcknowledge = { viewModel.acknowledgeAlert(alert.id) })
            }
        }
    }
}

@Composable
fun AlertHistoryItem(
    alert: AlertEntity,
    onAcknowledge: () -> Unit
) {
    val alertColor = when (alert.alertLevel) {
        "EXTREME" -> ImdExtreme
        "RED" -> ImdRed
        "ORANGE" -> ImdOrange
        "YELLOW" -> ImdYellow
        else -> ImdGreen
    }

    val timeStr = SimpleDateFormat("dd MMM, HH:mm IST", Locale.US).format(Date(alert.timestamp))

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        border = CardDefaults.outlinedCardBorder().let {
            androidx.compose.foundation.BorderStroke(1.dp, alertColor.copy(alpha = 0.5f))
        }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (alert.acknowledged) Icons.Default.CheckCircle else Icons.Default.Warning,
                contentDescription = null,
                tint = alertColor,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "${alert.alertLevel} — ${alert.location}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = alertColor
                    )
                    Text(
                        text = timeStr,
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = alert.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextPrimary
                )
            }
            if (!alert.acknowledged) {
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(onClick = onAcknowledge) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Acknowledge",
                        tint = CyanAccent
                    )
                }
            }
        }
    }
}
