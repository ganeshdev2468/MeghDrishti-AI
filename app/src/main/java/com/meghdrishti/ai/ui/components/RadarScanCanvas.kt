package com.meghdrishti.ai.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.unit.dp
import com.meghdrishti.ai.data.model.RadarScanData
import com.meghdrishti.ai.data.model.ReflectivityCell
import com.meghdrishti.ai.data.model.StormCell
import com.meghdrishti.ai.ui.theme.*
import kotlin.math.*

/**
 * Interactive Doppler Weather Radar (DWR) scope canvas.
 * Features:
 * - Rotating S-band/C-band radar sweep beam
 * - Range rings at 50, 100, 150, 200, 250 km
 * - IMD standard dBZ reflectivity color table
 * - TITAN/SCIT storm cell tracking vectors
 */
@Composable
fun RadarScanCanvas(
    radarData: RadarScanData,
    modifier: Modifier = Modifier
) {
    // Continuous beam sweep animation
    val infiniteTransition = rememberInfiniteTransition(label = "radarSweep")
    val sweepAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 4000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "sweepAngle"
    )

    // Fade-in pulse for new cells
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.6f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    Canvas(modifier = modifier.fillMaxWidth().aspectRatio(1f)) {
        val centerX = size.width / 2
        val centerY = size.height / 2
        val maxRadius = minOf(centerX, centerY) * 0.92f

        // ── Background ──
        drawCircle(
            color = DarkNavy,
            radius = maxRadius,
            center = Offset(centerX, centerY)
        )

        // ── Range Rings (50km intervals) ──
        val rangeSteps = 5
        for (i in 1..rangeSteps) {
            val ringRadius = maxRadius * i / rangeSteps
            drawCircle(
                color = CyanAccent.copy(alpha = 0.15f),
                radius = ringRadius,
                center = Offset(centerX, centerY),
                style = Stroke(width = 1f)
            )
        }

        // ── Cross-hairs ──
        drawLine(
            CyanAccent.copy(alpha = 0.12f),
            Offset(centerX - maxRadius, centerY),
            Offset(centerX + maxRadius, centerY),
            strokeWidth = 0.8f
        )
        drawLine(
            CyanAccent.copy(alpha = 0.12f),
            Offset(centerX, centerY - maxRadius),
            Offset(centerX, centerY + maxRadius),
            strokeWidth = 0.8f
        )

        // ── Reflectivity Cells ──
        radarData.reflectivityCells.forEach { cell ->
            val normalizedRange = (cell.range / radarData.maxRange).coerceIn(0f, 1f)
            val rad = Math.toRadians(cell.azimuth.toDouble())
            val cellX = centerX + (normalizedRange * maxRadius * sin(rad)).toFloat()
            val cellY = centerY - (normalizedRange * maxRadius * cos(rad)).toFloat()
            val cellColor = dbzToColor(cell.dbzValue)
            val cellSize = (2f + cell.dbzValue / 10f).coerceIn(2f, 10f)

            drawCircle(
                color = cellColor.copy(alpha = pulseAlpha * 0.8f),
                radius = cellSize,
                center = Offset(cellX, cellY)
            )
        }

        // ── Radar Sweep Beam ──
        val sweepRad = Math.toRadians(sweepAngle.toDouble())
        val beamEndX = centerX + (maxRadius * sin(sweepRad)).toFloat()
        val beamEndY = centerY - (maxRadius * cos(sweepRad)).toFloat()

        // Glow trail
        for (trailOffset in 1..12) {
            val trailAngle = Math.toRadians((sweepAngle - trailOffset * 2.5).toDouble())
            val trailX = centerX + (maxRadius * sin(trailAngle)).toFloat()
            val trailY = centerY - (maxRadius * cos(trailAngle)).toFloat()
            drawLine(
                TealAccent.copy(alpha = 0.03f * (12 - trailOffset)),
                Offset(centerX, centerY),
                Offset(trailX, trailY),
                strokeWidth = 2f
            )
        }

        drawLine(
            TealAccent.copy(alpha = 0.8f),
            Offset(centerX, centerY),
            Offset(beamEndX, beamEndY),
            strokeWidth = 2f
        )

        // ── Storm Cell Tracking Vectors (TITAN/SCIT) ──
        radarData.stormCells.forEach { storm ->
            val normalizedRange = (storm.range / radarData.maxRange).coerceIn(0f, 1f)
            val stormRad = Math.toRadians(storm.azimuth.toDouble())
            val stormX = centerX + (normalizedRange * maxRadius * sin(stormRad)).toFloat()
            val stormY = centerY - (normalizedRange * maxRadius * cos(stormRad)).toFloat()

            // Storm marker
            drawCircle(
                color = ImdRed.copy(alpha = pulseAlpha),
                radius = 8f,
                center = Offset(stormX, stormY),
                style = Stroke(width = 2f)
            )

            // Velocity vector arrow
            val headingRad = Math.toRadians(storm.velocityHeading.toDouble())
            val vecLen = (storm.velocitySpeed / 2f).coerceIn(10f, 40f)
            val vecEndX = stormX + (vecLen * sin(headingRad)).toFloat()
            val vecEndY = stormY - (vecLen * cos(headingRad)).toFloat()
            drawLine(
                ImdOrange,
                Offset(stormX, stormY),
                Offset(vecEndX, vecEndY),
                strokeWidth = 2.5f
            )
        }

        // ── Center Marker ──
        drawCircle(
            color = CyanAccent,
            radius = 4f,
            center = Offset(centerX, centerY)
        )
    }
}

/**
 * Convert dBZ reflectivity value to standard IMD Doppler color.
 */
private fun dbzToColor(dbz: Float): Color = when {
    dbz >= 60 -> DbzLevel65
    dbz >= 50 -> DbzLevel55
    dbz >= 40 -> DbzLevel45
    dbz >= 30 -> DbzLevel35
    dbz >= 20 -> DbzLevel25
    dbz >= 10 -> DbzLevel15
    else -> DbzLevel05
}
