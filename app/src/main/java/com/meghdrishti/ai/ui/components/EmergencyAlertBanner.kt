package com.meghdrishti.ai.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.meghdrishti.ai.data.model.ImdAlertLevel
import com.meghdrishti.ai.ui.theme.*

/**
 * Simulated risk banner using example rainfall-intensity thresholds; not an official alert.
 */
@Composable
fun EmergencyAlertBanner(
    alertLevel: ImdAlertLevel,
    location: String,
    message: String,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "alertPulse")

    val isCritical = alertLevel == ImdAlertLevel.RED || alertLevel == ImdAlertLevel.EXTREME

    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = if (isCritical) 0.7f else 1f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = if (isCritical) 600 else 2000,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    val alertColor = when (alertLevel) {
        ImdAlertLevel.EXTREME -> ImdExtreme
        ImdAlertLevel.RED -> ImdRed
        ImdAlertLevel.ORANGE -> ImdOrange
        ImdAlertLevel.YELLOW -> ImdYellow
        ImdAlertLevel.GREEN -> ImdGreen
    }

    val emoji = when (alertLevel) {
        ImdAlertLevel.EXTREME -> "EXTREME RISK SCENARIO"
        ImdAlertLevel.RED -> "RED RISK SCENARIO"
        ImdAlertLevel.ORANGE -> "ORANGE RISK SCENARIO"
        ImdAlertLevel.YELLOW -> "YELLOW RISK SCENARIO"
        ImdAlertLevel.GREEN -> "GREEN SCENARIO"
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = alertColor.copy(alpha = pulseAlpha * 0.25f)
        ),
        border = CardDefaults.outlinedCardBorder().let {
            androidx.compose.foundation.BorderStroke(
                width = if (isCritical) 2.dp else 1.dp,
                color = alertColor.copy(alpha = pulseAlpha)
            )
        }
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Alert Level Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = emoji,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color = alertColor
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Location
            Text(
                text = "📍 $location",
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Message
            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                lineHeight = 18.sp
            )

            // Critical alert action prompt
            if (isCritical) {
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(
                                    alertColor.copy(alpha = 0.3f),
                                    alertColor.copy(alpha = 0.1f)
                                )
                            )
                        )
                        .padding(8.dp)
                ) {
                    Text(
                        text = if (alertLevel == ImdAlertLevel.EXTREME)
                            "SIMULATION ONLY · Check official IMD and local emergency-service advisories."
                        else
                            "SIMULATION ONLY · Check official IMD and local emergency-service advisories.",
                        style = MaterialTheme.typography.labelSmall,
                        color = alertColor,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
