package com.example.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.RestTimerState
import com.example.ui.theme.Lime
import com.example.ui.theme.Surface3
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TimerBg

@Composable
fun RestTimerBar(
    timer: RestTimerState,
    remainingSec: Int,
    onTogglePause: () -> Unit,
    onRestart: () -> Unit,
    onSkip: () -> Unit,
    onAdjust: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val progress = (remainingSec.toFloat() / timer.plannedSec.coerceAtLeast(1).toFloat())
        .coerceIn(0f, 1f)

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = TimerBg,
        border = BorderStroke(1.dp, Lime),
        shadowElevation = 10.dp
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                    Text(
                        text = "DESCANSO • ${timer.exerciseName.uppercase()}",
                        color = Lime,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = IronLogViewModel.formatClock(remainingSec),
                        color = Lime,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    IronSecondaryButton(
                        text = if (timer.isPaused) "Continuar" else "Pausar",
                        onClick = onTogglePause,
                        compact = true
                    )
                    IronSecondaryButton(
                        text = "Reiniciar",
                        onClick = onRestart,
                        compact = true
                    )
                    IronSecondaryButton(
                        text = "Pular",
                        onClick = onSkip,
                        danger = true,
                        compact = true
                    )
                }
            }

            Spacer(Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Surface3)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(progress)
                        .height(4.dp)
                        .background(Lime)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Alvo: ${timer.plannedSec}s",
                    color = TextMuted,
                    fontSize = 11.sp
                )
                Row {
                    TextButton(onClick = { onAdjust(-15) }) {
                        Text("-15s", color = TextMuted, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                    TextButton(onClick = { onAdjust(15) }) {
                        Text("+15s", color = Lime, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
