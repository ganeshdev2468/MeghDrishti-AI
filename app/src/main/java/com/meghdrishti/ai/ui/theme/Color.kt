package com.meghdrishti.ai.ui.theme

import androidx.compose.ui.graphics.Color

// ═══════════════════════════════════════════════════════
// MeghDrishti AI — ISRO/IMD Mission Control Color System
// ═══════════════════════════════════════════════════════

// Primary Dark Surfaces (Mission Control)
val DarkNavy = Color(0xFF0D1B2A)
val DarkSurface = Color(0xFF1B2838)
val DarkCard = Color(0xFF1E3148)
val DarkElevated = Color(0xFF243B53)

// Accent Colors (Radar/Telemetry)
val CyanAccent = Color(0xFF00E5FF)
val TealAccent = Color(0xFF1DE9B6)
val BlueAccent = Color(0xFF448AFF)
val IndigoAccent = Color(0xFF536DFE)

// IMD Alert Level Colors
val ImdGreen = Color(0xFF2E7D32)
val ImdYellow = Color(0xFFF9A825)
val ImdOrange = Color(0xFFEF6C00)
val ImdRed = Color(0xFFC62828)
val ImdExtreme = Color(0xFF6A1B9A)

// Radar dBZ Reflectivity Scale (Standard IMD Doppler Color Table)
val DbzLevel05 = Color(0xFF00BFFF)   // 5–10 dBZ  Light drizzle
val DbzLevel15 = Color(0xFF00FF00)   // 10–20 dBZ Light rain
val DbzLevel25 = Color(0xFFFFFF00)   // 20–30 dBZ Moderate rain
val DbzLevel35 = Color(0xFFFF8C00)   // 30–40 dBZ Heavy rain
val DbzLevel45 = Color(0xFFFF0000)   // 40–50 dBZ Very heavy rain
val DbzLevel55 = Color(0xFFDC143C)   // 50–60 dBZ Extreme rain / hail
val DbzLevel65 = Color(0xFF8B008B)   // 60+ dBZ   Violent / tornadogenesis

// Inundation Depth Colors
val FloodLow = Color(0xFF81D4FA)
val FloodModerate = Color(0xFF1565C0)
val FloodSevere = Color(0xFFD32F2F)
val FloodCatastrophe = Color(0xFF4A148C)

// Text Colors
val TextPrimary = Color(0xFFE0E6ED)
val TextSecondary = Color(0xFF8899A6)
val TextMuted = Color(0xFF5C6F7E)

// Satellite Infrared Color Scale
val SatIR_Cold = Color(0xFFE91E63)    // Very cold cloud tops (deep convection)
val SatIR_Medium = Color(0xFFFF9800)  // Mid-level clouds
val SatIR_Warm = Color(0xFF4CAF50)    // Low/warm clouds
val SatIR_Surface = Color(0xFF607D8B) // Clear sky / surface
