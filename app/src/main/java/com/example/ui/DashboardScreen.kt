package com.example.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.Lime
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import kotlin.math.roundToInt

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DashboardScreen(
    state: IronLogUiState,
    onResumeActive: () -> Unit,
    onStartWorkout: (String) -> Unit,
    onOpenSessionDetail: (String) -> Unit,
    onOpenScheduleConfig: () -> Unit
) {
    val isoDay = IronLogViewModel.currentIsoDayOfWeek()
    val dayLabel = IronLogViewModel.dayNamePt(isoDay)
    val sortedWorkouts = state.workouts.sortedBy { it.dayOfWeek }
    val todayWorkout = sortedWorkouts.firstOrNull { it.dayOfWeek == isoDay }
    val trainingDaysSummary = if (sortedWorkouts.isEmpty()) {
        "Seg • Ter • Qui • Sex"
    } else {
        sortedWorkouts.joinToString(" • ") { IronLogViewModel.shortDayPt(it.dayOfWeek) }
    }

    val weekStart = IronLogViewModel.startOfWeekMillis()
    val weekMs = 7L * 24L * 3600L * 1000L
    val prevWeekStart = weekStart - weekMs

    val completed = state.sessions.filter { it.status == "completed" }
    val weekCompleted = completed.filter { it.startedAt >= weekStart }
    val weekVolume = weekCompleted.sumOf { it.totalVolumeKg }
    val prevWeekVolume = completed
        .filter { it.startedAt in prevWeekStart until weekStart }
        .sumOf { it.totalVolumeKg }

    val lastSession = completed.firstOrNull()

    val evolutionText = when {
        completed.isNotEmpty() && prevWeekVolume > 0.0 && weekVolume > 0.0 -> {
            val pct = (((weekVolume - prevWeekVolume) / prevWeekVolume) * 100.0).roundToInt()
            "${if (pct >= 0) "+" else ""}$pct% volume vs semana passada"
        }
        lastSession != null -> "${lastSession.workoutName} concluído"
        else -> "Registre treinos para acompanhar sua evolução"
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Active workout banner
        val active = state.activeSession
        if (active != null) {
            IronCard(highlight = true) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        IronBadge(text = "Em andamento", accent = true)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = active.session.workoutName,
                            color = TextPrimary,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp
                        )
                        Text(
                            text = "Iniciado em ${IronLogViewModel.formatDate(active.session.startedAt)}",
                            color = TextMuted,
                            fontSize = 12.sp
                        )
                    }
                    IronPrimaryButton(
                        text = "Retomar",
                        onClick = onResumeActive,
                        compact = true
                    )
                }
            }
        }

        // Treino do dia
        IronCard(highlight = active == null && todayWorkout != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IronBadge(text = dayLabel, accent = todayWorkout != null)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = IronLogViewModel.formatDate(System.currentTimeMillis()),
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                    IronSecondaryButton(
                        text = "Descanso",
                        onClick = onOpenScheduleConfig,
                        compact = true
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            if (todayWorkout != null) {
                Text(
                    text = todayWorkout.name,
                    color = TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = todayWorkout.subtitle,
                    color = TextMuted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                )
                IronPrimaryButton(
                    text = if (active != null) "Há um treino em andamento" else "Iniciar treino do dia",
                    onClick = { onStartWorkout(todayWorkout.id) },
                    enabled = active == null,
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                Text(
                    text = "Dia de Descanso",
                    color = TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = "Recuperação muscular programada. Caso queira treinar hoje, escolha uma ficha:",
                    color = TextMuted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 3.dp, bottom = 10.dp)
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    sortedWorkouts.forEach { wk ->
                        IronSecondaryButton(
                            text = wk.code.replace("_", " "),
                            onClick = { if (active == null) onStartWorkout(wk.id) },
                            compact = true
                        )
                    }
                }
            }
        }

        // Weekly metrics
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            StatBox(
                label = "Treinos na semana",
                value = "${weekCompleted.size} / ${sortedWorkouts.size.coerceAtLeast(4)}",
                subtitle = trainingDaysSummary,
                modifier = Modifier.weight(1f)
            )
            StatBox(
                label = "Volume semanal",
                value = "${weekVolume.roundToInt()} kg",
                subtitle = "${weekCompleted.size} sessões",
                modifier = Modifier.weight(1f),
                accentValue = true
            )
        }

        // Último treino
        IronCard {
            Text(
                text = "ÚLTIMO TREINO",
                color = TextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
            )
            Spacer(Modifier.height(6.dp))
            if (lastSession != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = lastSession.workoutName,
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = IronLogViewModel.formatDate(lastSession.startedAt),
                            color = TextMuted,
                            fontSize = 12.sp
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "${lastSession.totalVolumeKg.roundToInt()} kg",
                            color = Lime,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 15.sp
                        )
                        TextButton(onClick = { onOpenSessionDetail(lastSession.id) }) {
                            Text("Ver detalhes", color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }
            } else {
                Text(
                    text = "Nenhum treino concluído ainda.",
                    color = TextMuted,
                    fontSize = 13.sp
                )
            }
        }

        // Evolução recente
        IronCard {
            Text(
                text = "EVOLUÇÃO RECENTE",
                color = TextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = evolutionText,
                color = TextPrimary,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
        }
    }
}
