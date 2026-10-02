package com.meghdrishti.ai.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.unit.dp
import com.meghdrishti.ai.ui.theme.*
import kotlin.math.*

/**
 * CartoDEM Topographical Cross-Section Canvas with animated flood simulation.
 * Displays elevation cross-section from ridge to river outfall with:
 * - DEM terrain profile (10m resolution simulation)
 * - Animated flood water level rise
 * - Drainage choke points identification
 * - Pump station capacity indicators
 */
@Composable
fun TopographicalInundationCanvas(
    rainfallIntensity: Float, // mm/hr
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "flood")
    val waterWave by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(3000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "wave"
    )

    val floodLevel = (rainfallIntensity / 250f).coerceIn(0f, 1f)

    Canvas(modifier = modifier.fillMaxWidth().height(220.dp)) {
        val w = size.width
        val h = size.height
        val baseY = h * 0.85f

        // ── DEM Terrain Profile ──
        val terrainPath = Path().apply {
            moveTo(0f, baseY)
            // Ridge
            lineTo(w * 0.05f, baseY - h * 0.55f)
            lineTo(w * 0.12f, baseY - h * 0.50f)
            // Slope
            lineTo(w * 0.20f, baseY - h * 0.35f)
            // Plateau with buildings
            lineTo(w * 0.25f, baseY - h * 0.30f)
            lineTo(w * 0.30f, baseY - h * 0.30f)
            // Underpass depression
            lineTo(w * 0.35f, baseY - h * 0.12f)
            lineTo(w * 0.40f, baseY - h * 0.08f) // lowest point
            lineTo(w * 0.45f, baseY - h * 0.12f)
            // Urban area
            lineTo(w * 0.50f, baseY - h * 0.22f)
            lineTo(w * 0.58f, baseY - h * 0.20f)
            // River channel depression
            lineTo(w * 0.62f, baseY - h * 0.15f)
            lineTo(w * 0.68f, baseY - h * 0.05f) // river bed
            lineTo(w * 0.74f, baseY - h * 0.15f)
            // Coastal area
            lineTo(w * 0.82f, baseY - h * 0.18f)
            lineTo(w * 0.90f, baseY - h * 0.10f)
            lineTo(w * 0.95f, baseY - h * 0.04f)
            lineTo(w, baseY)
            lineTo(w, h)
            lineTo(0f, h)
            close()
        }

        // Terrain fill
        drawPath(
            terrainPath,
            brush = Brush.verticalGradient(
                colors = listOf(
                    Color(0xFF2E7D32).copy(alpha = 0.8f),
                    Color(0xFF4E342E).copy(alpha = 0.9f),
                    Color(0xFF3E2723)
                )
            )
        )

        // Terrain outline
        val terrainOutline = Path().apply {
            moveTo(0f, baseY)
            lineTo(w * 0.05f, baseY - h * 0.55f)
            lineTo(w * 0.12f, baseY - h * 0.50f)
            lineTo(w * 0.20f, baseY - h * 0.35f)
            lineTo(w * 0.25f, baseY - h * 0.30f)
            lineTo(w * 0.30f, baseY - h * 0.30f)
            lineTo(w * 0.35f, baseY - h * 0.12f)
            lineTo(w * 0.40f, baseY - h * 0.08f)
            lineTo(w * 0.45f, baseY - h * 0.12f)
            lineTo(w * 0.50f, baseY - h * 0.22f)
            lineTo(w * 0.58f, baseY - h * 0.20f)
            lineTo(w * 0.62f, baseY - h * 0.15f)
            lineTo(w * 0.68f, baseY - h * 0.05f)
            lineTo(w * 0.74f, baseY - h * 0.15f)
            lineTo(w * 0.82f, baseY - h * 0.18f)
            lineTo(w * 0.90f, baseY - h * 0.10f)
            lineTo(w * 0.95f, baseY - h * 0.04f)
            lineTo(w, baseY)
        }
        drawPath(terrainOutline, color = TealAccent.copy(alpha = 0.5f), style = Stroke(1.5f))

        // ── Animated Flood Water ──
        if (floodLevel > 0.02f) {
            val waterTop = baseY - (h * 0.5f * floodLevel)

            val waterPath = Path().apply {
                moveTo(0f, h)
                // Wave surface
                for (x in 0..size.width.toInt() step 4) {
                    val xf = x.toFloat()
                    val waveY = waterTop + sin(xf * 0.03f + waterWave) * 3f
                    if (x == 0) moveTo(xf, waveY) else lineTo(xf, waveY)
                }
                lineTo(w, h)
                close()
            }

            val waterColor = when {
                floodLevel > 0.7f -> FloodCatastrophe.copy(alpha = 0.6f)
                floodLevel > 0.4f -> FloodSevere.copy(alpha = 0.55f)
                floodLevel > 0.2f -> FloodModerate.copy(alpha = 0.5f)
                else -> FloodLow.copy(alpha = 0.45f)
            }

            drawPath(waterPath, color = waterColor)

            // Water surface shimmer
            for (x in 0..size.width.toInt() step 8) {
                val xf = x.toFloat()
                val waveY = waterTop + sin(xf * 0.03f + waterWave) * 3f
                drawCircle(
                    color = Color.White.copy(alpha = 0.12f),
                    radius = 1.5f,
                    center = Offset(xf, waveY)
                )
            }
        }

        // ── Choke Point Markers ──
        // Underpass
        drawCircle(
            color = ImdRed.copy(alpha = 0.8f),
            radius = 6f,
            center = Offset(w * 0.40f, baseY - h * 0.08f),
            style = Stroke(2f)
        )
        // River bed
        drawCircle(
            color = ImdOrange.copy(alpha = 0.8f),
            radius = 6f,
            center = Offset(w * 0.68f, baseY - h * 0.05f),
            style = Stroke(2f)
        )
    }
}
