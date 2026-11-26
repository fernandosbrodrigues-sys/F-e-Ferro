package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val IronLogColorScheme = darkColorScheme(
    primary = Lime,
    onPrimary = BgBlack,
    primaryContainer = LimeDim,
    onPrimaryContainer = LimeBright,
    secondary = Surface2,
    onSecondary = TextPrimary,
    secondaryContainer = Surface3,
    onSecondaryContainer = TextPrimary,
    background = BgBlack,
    onBackground = TextPrimary,
    surface = Surface1,
    onSurface = TextPrimary,
    surfaceVariant = Surface2,
    onSurfaceVariant = TextMuted,
    outline = BorderSubtle,
    error = Danger,
    onError = BgBlack,
    errorContainer = DangerDim,
    onErrorContainer = DangerText,
)

@Composable
fun IronLogTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = IronLogColorScheme,
        typography = Typography,
        content = content,
    )
}
