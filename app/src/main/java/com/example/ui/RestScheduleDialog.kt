package com.example.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.WorkoutEntity
import com.example.data.WorkoutSeed
import com.example.ui.theme.BgBlack
import com.example.ui.theme.BorderSubtle
import com.example.ui.theme.Lime
import com.example.ui.theme.LimeBorder
import com.example.ui.theme.LimeDim
import com.example.ui.theme.Surface1
import com.example.ui.theme.Surface2
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary

@Composable
fun RestScheduleDialog(
    workouts: List<WorkoutEntity>,
    onDismiss: () -> Unit,
    onSave: (List<Pair<String, Int>>) -> Unit
) {
    var slots by remember(workouts) {
        mutableStateOf(WorkoutSeed.buildSlotsFromWorkouts(workouts))
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 24.dp),
            shape = RoundedCornerShape(16.dp),
            color = Surface1,
            border = BorderStroke(1.dp, BorderSubtle)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Dias de Descanso e Treino",
                        color = TextPrimary,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 16.sp
                    )
                    TextButton(onClick = onDismiss) {
                        Text("Fechar", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Text(
                    text = "Escolha o dia de descanso: ao descansar em um dia de treino, ele passa para o próximo dia automaticamente.",
                    color = TextMuted,
                    fontSize = 12.sp
                )

                Spacer(Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    ScheduleQuickChip(
                        label = "← Voltar 1 dia",
                        accent = false,
                        onClick = { slots = WorkoutSeed.shiftAllByOneDay(slots, -1) },
                        modifier = Modifier.weight(1f)
                    )
                    ScheduleQuickChip(
                        label = "Empurrar +1 dia",
                        accent = true,
                        onClick = { slots = WorkoutSeed.shiftAllByOneDay(slots, 1) },
                        modifier = Modifier.weight(1f)
                    )
                    ScheduleQuickChip(
                        label = "Padrão",
                        accent = false,
                        onClick = { slots = WorkoutSeed.resetDefaultSlots(workouts) },
                        modifier = Modifier.weight(0.7f)
                    )
                }

                Spacer(Modifier.height(10.dp))

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (day in 1..7) {
                        val wk = slots[day]
                        val isRest = wk == null
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isRest) BgBlack else Surface2)
                                .border(
                                    width = 1.dp,
                                    color = if (isRest) BorderSubtle else LimeBorder,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                                Text(
                                    text = IronLogViewModel.dayNamePt(day),
                                    color = TextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                                if (wk != null) {
                                    Text(
                                        text = "${wk.code.replace("_", " ")} · ${wk.subtitle}",
                                        color = Lime,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 12.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                } else {
                                    Text(
                                        text = "Descanso",
                                        color = TextMuted,
                                        fontSize = 12.sp
                                    )
                                }
                            }

                            if (wk != null) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Surface1)
                                        .border(1.dp, BorderSubtle, RoundedCornerShape(8.dp))
                                        .clickable { slots = WorkoutSeed.setDayAsRest(slots, day) }
                                        .padding(horizontal = 10.dp, vertical = 7.dp)
                                ) {
                                    Text(
                                        text = "Descansar",
                                        color = TextPrimary,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                }
                            } else {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(LimeDim)
                                        .border(1.dp, LimeBorder, RoundedCornerShape(8.dp))
                                        .clickable { slots = WorkoutSeed.setDayAsTraining(slots, day) }
                                        .padding(horizontal = 10.dp, vertical = 7.dp)
                                ) {
                                    Text(
                                        text = "Treinar aqui",
                                        color = Lime,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                HorizontalDivider(color = BorderSubtle)
                Spacer(Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IronSecondaryButton(
                        text = "Cancelar",
                        onClick = onDismiss,
                        compact = true
                    )
                    Spacer(Modifier.width(8.dp))
                    IronPrimaryButton(
                        text = "Salvar escala",
                        onClick = {
                            val assignments = (1..7).mapNotNull { d ->
                                slots[d]?.let { wk -> wk.id to d }
                            }
                            if (assignments.size == workouts.size) {
                                onSave(assignments)
                                onDismiss()
                            }
                        },
                        compact = true
                    )
                }
            }
        }
    }
}

@Composable
private fun ScheduleQuickChip(
    label: String,
    accent: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Surface2)
            .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 9.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = if (accent) Lime else TextPrimary,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}
