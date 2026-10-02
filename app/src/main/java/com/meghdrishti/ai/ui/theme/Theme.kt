package com.meghdrishti.ai.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val MeghDrishtiColorScheme = darkColorScheme(
    primary = CyanAccent,
    onPrimary = DarkNavy,
    primaryContainer = DarkElevated,
    onPrimaryContainer = CyanAccent,
    secondary = TealAccent,
    onSecondary = DarkNavy,
    secondaryContainer = DarkCard,
    onSecondaryContainer = TealAccent,
    tertiary = IndigoAccent,
    onTertiary = DarkNavy,
    background = DarkNavy,
    onBackground = TextPrimary,
    surface = DarkSurface,
    onSurface = TextPrimary,
    surfaceVariant = DarkCard,
    onSurfaceVariant = TextSecondary,
    error = ImdRed,
    onError = TextPrimary,
    outline = TextMuted,
)

@Composable
fun MeghDrishtiTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            window.statusBarColor = DarkNavy.toArgb()
            window.navigationBarColor = DarkNavy.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
    }

    MaterialTheme(
        colorScheme = MeghDrishtiColorScheme,
        content = content
    )
}
