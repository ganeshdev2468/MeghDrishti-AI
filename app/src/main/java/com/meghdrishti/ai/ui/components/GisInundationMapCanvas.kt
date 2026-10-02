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
import com.meghdrishti.ai.data.model.InundationScenario
import com.meghdrishti.ai.ui.theme.*
import kotlin.math.*

/**
 * 2D GIS-style inundation map canvas showing:
 * - Topographical contour lines (CartoDEM 10m simulation)
 * - River channel
 * - Flooded polygon extent based on return period
 * - Critical infrastructure markers
 * - Scale bar and compass
 */
@Composable
fun GisInundationMapCanvas(
    scenario: InundationScenario?,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "gisFlood")
    val floodPulse by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "floodPulse"
    )

    Canvas(modifier = modifier.fillMaxWidth().height(280.dp)) {
        val w = size.width
        val h = size.height

        // ── Background (map base) ──
        drawRect(color = DarkNavy)

        // ── Topographic Contour Lines ──
        val contourElevations = listOf(5f, 10f, 20f, 35f, 50f)
        contourElevations.forEachIndexed { index, _ ->
            val contourPath = Path().apply {
                val baseRadius = w * 0.12f + index * w * 0.07f
                moveTo(w * 0.5f + baseRadius, h * 0.45f)
                for (angle in 0..360 step 5) {
                    val rad = Math.toRadians(angle.toDouble())
                    val jitter = sin(angle * 0.1 + index * 2.0) * w * 0.02f
                    val r = baseRadius + jitter.toFloat()
                    val x = w * 0.5f + (r * cos(rad)).toFloat()
                    val y = h * 0.45f + (r * 0.7f * sin(rad)).toFloat()
                    lineTo(x, y)
                }
            }
            drawPath(
                contourPath,
                color = TealAccent.copy(alpha = 0.12f + index * 0.03f),
                style = Stroke(width = 0.8f)
            )
        }

        // ── River Channel ──
        val riverPath = Path().apply {
            moveTo(w * 0.1f, h * 0.15f)
            cubicTo(w * 0.25f, h * 0.3f, w * 0.35f, h * 0.35f, w * 0.5f, h * 0.45f)
            cubicTo(w * 0.65f, h * 0.55f, w * 0.75f, h * 0.7f, w * 0.9f, h * 0.85f)
        }
        drawPath(
            riverPath,
            color = BlueAccent.copy(alpha = 0.6f),
            style = Stroke(width = 3f, cap = StrokeCap.Round)
        )

        // ── Flood Extent Polygon ──
        if (scenario != null && scenario.maxFloodDepth > 0.05) {
            val floodRadius = w * 0.08f + (scenario.floodedArea * w * 0.012f).toFloat()
                .coerceAtMost(w * 0.35f)

            val floodPath = Path().apply {
                val cx = w * 0.5f
                val cy = h * 0.45f
                moveTo(cx + floodRadius, cy)
                for (angle in 0..360 step 8) {
                    val rad = Math.toRadians(angle.toDouble())
                    val jitter = sin(angle * 0.15) * floodRadius * 0.15f
                    val r = floodRadius + jitter.toFloat()
                    val x = cx + (r * cos(rad)).toFloat()
                    val y = cy + (r * 0.65f * sin(rad)).toFloat()
                    lineTo(x, y)
                }
                close()
            }

            val depthColor = when {
                scenario.maxFloodDepth >= 1.5 -> FloodCatastrophe
                scenario.maxFloodDepth >= 0.8 -> FloodSevere
                scenario.maxFloodDepth >= 0.3 -> FloodModerate
                else -> FloodLow
            }

            drawPath(floodPath, color = depthColor.copy(alpha = floodPulse))
            drawPath(floodPath, color = depthColor.copy(alpha = 0.9f),
                style = Stroke(width = 1.5f, pathEffect = PathEffect.dashPathEffect(
                    floatArrayOf(8f, 4f), 0f
                )))
        }

        // ── Critical Infrastructure Markers ──
        val markers = listOf(
            Triple(w * 0.35f, h * 0.3f, "H"),  // Hospital
            Triple(w * 0.6f, h * 0.55f, "M"),   // Metro
            Triple(w * 0.45f, h * 0.65f, "E"),  // Electrical
            Triple(w * 0.7f, h * 0.4f, "S"),    // School/Shelter
        )
        markers.forEach { (x, y, label) ->
            drawCircle(
                color = ImdYellow.copy(alpha = 0.8f),
                radius = 8f,
                center = Offset(x, y)
            )
            drawCircle(
                color = DarkNavy,
                radius = 5.5f,
                center = Offset(x, y)
            )
        }

        // ── Compass Rose ──
        val compassX = w - 35f
        val compassY = 35f
        drawLine(CyanAccent.copy(alpha = 0.6f),
            Offset(compassX, compassY - 15f), Offset(compassX, compassY + 15f), 1.5f)
        drawLine(CyanAccent.copy(alpha = 0.6f),
            Offset(compassX - 15f, compassY), Offset(compassX + 15f, compassY), 1.5f)
        // North arrow
        val arrowPath = Path().apply {
            moveTo(compassX, compassY - 18f)
            lineTo(compassX - 4f, compassY - 10f)
            lineTo(compassX + 4f, compassY - 10f)
            close()
        }
        drawPath(arrowPath, color = ImdRed.copy(alpha = 0.8f))

        // ── Scale Bar ──
        val scaleY = h - 20f
        drawLine(TextSecondary.copy(alpha = 0.6f),
            Offset(15f, scaleY), Offset(15f + w * 0.2f, scaleY), 2f)
        drawLine(TextSecondary.copy(alpha = 0.6f),
            Offset(15f, scaleY - 5f), Offset(15f, scaleY + 5f), 1.5f)
        drawLine(TextSecondary.copy(alpha = 0.6f),
            Offset(15f + w * 0.2f, scaleY - 5f), Offset(15f + w * 0.2f, scaleY + 5f), 1.5f)
    }
}
