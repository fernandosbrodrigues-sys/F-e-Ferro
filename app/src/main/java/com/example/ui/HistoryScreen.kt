package com.example.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.AlternativeOption
import com.example.data.SessionDetailUi
import com.example.data.WorkoutSeed
import com.example.ui.theme.BorderSubtle
import com.example.ui.theme.Lime
import com.example.ui.theme.Surface1
import com.example.ui.theme.Surface2
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import kotlin.math.roundToInt

@Composable
fun HistoryScreen(
    state: IronLogUiState,
    viewModel: IronLogViewModel,
    selectedSessionId: String?,
    onOpenSession: (String?) -> Unit
) {
    val completedSessions = state.sessions.filter { it.status == "completed" }
    val completedIds = completedSessions.map { it.id }.toSet()
    val weekBars = viewModel.computeWeeklyVolumeBars(state.sessions)

    val variations = remember(state.setLogs, completedIds) {
        val map = linkedMapOf<String, String>()
        state.setLogs
            .filter { it.completed && it.sessionId in completedIds }
            .forEach { l -> map.putIfAbsent(l.exerciseKey, l.exerciseName) }
        map.toMap()
    }

    var selectedKey by remember(variations) {
        mutableStateOf(variations.keys.firstOrNull() ?: "")
    }
    if (selectedKey !in variations && variations.isNotEmpty()) {
        selectedKey = variations.keys.first()
    }
    var menuExpanded by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionHeader(title = "Volume Semanal (kg)", modifier = Modifier.padding(top = 0.dp))
        IronCard {
            IronBarChart(weekBars)
        }

        SectionHeader(title = "Evolução e Recordes por Exercício")
        IronCard {
            if (variations.isEmpty()) {
                Text(
                    text = "Conclua treinos para visualizar gráficos de progressão e recordes pessoais.",
                    color = TextMuted,
                    fontSize = 13.sp
                )
            } else {
                Text("Exercício / Variação", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(5.dp))
                Box {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Surface2,
                        border = BorderStroke(1.dp, BorderSubtle),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { menuExpanded = true }
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = variations[selectedKey] ?: "",
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Text("▼", color = Lime, fontSize = 12.sp)
                        }
                    }
                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false },
                        modifier = Modifier.background(Surface2)
                    ) {
                        variations.forEach { (k, name) ->
                            DropdownMenuItem(
                                text = { Text(name, color = if (k == selectedKey) Lime else TextPrimary) },
                                onClick = {
                                    selectedKey = k
                                    menuExpanded = false
                                }
                            )
                        }
                    }
                }

                val (pr, chartPoints) = viewModel.computeExerciseStats(
                    exerciseKey = selectedKey,
                    sessions = state.sessions,
                    setLogs = state.setLogs
                )

                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    StatBox(
                        label = "PR Carga Máxima",
                        value = "${IronLogViewModel.formatKg(pr.maxWeightKg)} kg",
                        subtitle = variations[selectedKey] ?: "",
                        modifier = Modifier.weight(1f),
                        accentValue = true
                    )
                    StatBox(
                        label = "1RM Estimado",
                        value = "${pr.estimated1RmKg.roundToInt()} kg",
                        subtitle = "Máx série: ${pr.maxSetVolumeKg.roundToInt()} kg",
                        modifier = Modifier.weight(1f)
                    )
                }
                Spacer(Modifier.height(6.dp))
                IronLineChart(points = chartPoints, unit = "kg")
            }
        }

        SectionHeader(title = "Histórico de Treinos (${completedSessions.size})")
        if (completedSessions.isEmpty()) {
            IronCard {
                Text("Nenhum treino registrado até o momento.", color = TextMuted, fontSize = 13.sp)
            }
        } else {
            completedSessions.forEach { sess ->
                IronCard(onClick = { onOpenSession(sess.id) }) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(sess.workoutName, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text(IronLogViewModel.formatDate(sess.startedAt), color = TextMuted, fontSize = 12.sp)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                "${sess.totalVolumeKg.roundToInt()} kg",
                                color = Lime,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 15.sp
                            )
                            Text("Tocar p/ editar", color = TextMuted, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }

    if (selectedSessionId != null) {
        val detail = viewModel.getSessionDetail(selectedSessionId)
        if (detail != null) {
            SessionDetailDialog(
                detail = detail,
                onDismiss = { onOpenSession(null) },
                onUpdateSet = viewModel::updateSetField,
                onToggleDone = viewModel::toggleSetCompleted,
                onChangeVariation = viewModel::editHistoricalExerciseVariation
            )
        }
    }
}

@Composable
fun SessionDetailDialog(
    detail: SessionDetailUi,
    onDismiss: () -> Unit,
    onUpdateSet: (setId: String, weightKg: Double?, reps: Int?, rir: Int?, plannedRestSec: Int) -> Unit,
    onToggleDone: (String) -> Unit,
    onChangeVariation: (sessionExerciseId: String, option: AlternativeOption) -> Unit
) {
    var editingVariationForId by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Surface1,
        title = {
            Column {
                Text(detail.session.workoutName, color = TextPrimary, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp)
                Text(
                    "${IronLogViewModel.formatDate(detail.session.startedAt)} • Volume: ${detail.session.totalVolumeKg.roundToInt()} kg",
                    color = TextMuted,
                    fontSize = 12.sp
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 460.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                detail.items.forEach { item ->
                    val se = item.exercise
                    val isSub = se.performedExerciseKey != se.originalExerciseKey
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(se.performedExerciseName, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                if (isSub) {
                                    Text("Substituiu: ${se.originalExerciseName}", color = Lime, fontSize = 11.sp)
                                }
                            }
                            TextButton(onClick = { editingVariationForId = se.id }) {
                                Text("Trocar variação", color = Lime, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        if (editingVariationForId == se.id) {
                            val options = buildList {
                                add(AlternativeOption(se.originalExerciseKey, se.originalExerciseName, se.defaultRestSec))
                                addAll(WorkoutSeed.decodeAlternatives(se.alternativesJson))
                            }.distinctBy { it.key }
                            Column(
                                modifier = Modifier.padding(bottom = 6.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                options.forEach { opt ->
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = Surface2,
                                        border = BorderStroke(1.dp, if (opt.key == se.performedExerciseKey) Lime else BorderSubtle),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                onChangeVariation(se.id, opt)
                                                editingVariationForId = null
                                            }
                                    ) {
                                        Text(
                                            text = opt.name,
                                            color = if (opt.key == se.performedExerciseKey) Lime else TextPrimary,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.padding(8.dp)
                                        )
                                    }
                                }
                            }
                        }

                        item.sets.forEach { s ->
                            SetLogCard(
                                setLog = s,
                                repPlaceholder = "${se.repMin}-${se.repMax}",
                                weightPlaceholder = "0",
                                canDelete = false,
                                onUpdate = onUpdateSet,
                                onToggleDone = { onToggleDone(s.id) },
                                onDelete = {}
                            )
                        }
                        HorizontalDivider(color = BorderSubtle, modifier = Modifier.padding(top = 10.dp))
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar", color = Lime, fontWeight = FontWeight.Bold)
            }
        }
    )
}
