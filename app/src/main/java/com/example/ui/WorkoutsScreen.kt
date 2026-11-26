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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.ActiveSessionExerciseUi
import com.example.data.AlternativeOption
import com.example.data.RestTimerState
import com.example.data.SetLogEntity
import com.example.data.WorkoutSeed
import com.example.ui.theme.BgBlack
import com.example.ui.theme.BorderSubtle
import com.example.ui.theme.DangerBorder
import com.example.ui.theme.DangerDim
import com.example.ui.theme.DangerText
import com.example.ui.theme.Lime
import com.example.ui.theme.LimeBorder
import com.example.ui.theme.LimeDim
import com.example.ui.theme.Surface1
import com.example.ui.theme.Surface2
import com.example.ui.theme.Surface3
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary

@Composable
fun WorkoutsScreen(
    state: IronLogUiState,
    activeTimer: RestTimerState?,
    timerRemainingSec: Int,
    onStartWorkout: (String) -> Unit,
    onOpenScheduleConfig: () -> Unit,
    onStartSetTimer: (SetLogEntity, Int) -> Unit,
    onTogglePauseTimer: () -> Unit,
    onRestartTimer: () -> Unit,
    onSkipTimer: () -> Unit,
    onUpdateSet: (setId: String, weightKg: Double?, reps: Int?, rir: Int?, plannedRestSec: Int) -> Unit,
    onToggleSetDone: (String) -> Unit,
    onAddSet: (String) -> Unit,
    onDeleteSet: (String) -> Unit,
    onSubstituteExercise: (sessionExerciseId: String, option: AlternativeOption) -> Unit,
    onFinishSession: () -> Unit,
    onDiscardSession: () -> Unit
) {
    val active = state.activeSession
    var subTarget by remember { mutableStateOf<ActiveSessionExerciseUi?>(null) }
    var confirmDiscard by remember { mutableStateOf(false) }
    var confirmFinishEmpty by remember { mutableStateOf(false) }

    val sortedWorkouts = state.workouts.sortedBy { it.dayOfWeek }
    val restDays = (1..7).filter { d -> sortedWorkouts.none { it.dayOfWeek == d } }
    val restDaysText = when {
        restDays.isEmpty() -> "Nenhum dia de descanso"
        restDays.size == 1 -> IronLogViewModel.dayNamePt(restDays[0])
        else -> restDays.dropLast(1).joinToString(", ") { IronLogViewModel.dayNamePt(it) } +
            " e " + IronLogViewModel.dayNamePt(restDays.last())
    }

    if (active == null) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                SectionHeader(title = "Ficha de Treinamento", modifier = Modifier.padding(top = 0.dp))
                IronSecondaryButton(
                    text = "Configurar descanso",
                    onClick = onOpenScheduleConfig,
                    compact = true
                )
            }
            sortedWorkouts.forEach { wk ->
                val exs = state.exercises.filter { it.workoutId == wk.id }.sortedBy { it.sortOrder }
                IronCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                            Text(wk.name, color = TextPrimary, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                            Text(wk.subtitle, color = TextMuted, fontSize = 12.sp)
                        }
                        IronPrimaryButton(
                            text = "Iniciar",
                            onClick = { onStartWorkout(wk.id) },
                            compact = true
                        )
                    }
                    HorizontalDivider(color = BorderSubtle, modifier = Modifier.padding(vertical = 10.dp))
                    exs.forEach { ex ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(ex.name, color = TextPrimary, fontSize = 13.sp, modifier = Modifier.weight(1f))
                            Text(
                                "${ex.targetSets}×${ex.repMin}–${ex.repMax} • ${ex.defaultRestSec}s",
                                color = TextMuted,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
            IronCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                        Text(restDaysText, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("Dias programados de descanso.", color = TextMuted, fontSize = 13.sp)
                    }
                    IronSecondaryButton(
                        text = "Alterar",
                        onClick = onOpenScheduleConfig,
                        compact = true
                    )
                }
            }
        }
        return
    }

    val allSets = active.items.flatMap { it.sets }
    val doneCount = allSets.count { it.completed }
    val totalCount = allSets.size

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        IronCard(highlight = true) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                    IronBadge(text = "Treino ativo • $doneCount/$totalCount séries", accent = true)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = active.session.workoutName,
                        color = TextPrimary,
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp
                    )
                }
                IronPrimaryButton(
                    text = "Finalizar",
                    onClick = {
                        if (doneCount == 0) confirmFinishEmpty = true else onFinishSession()
                    },
                    compact = true
                )
            }
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Séries salvas automaticamente.", color = TextMuted, fontSize = 12.sp)
                TextButton(onClick = { confirmDiscard = true }) {
                    Text("Descartar", color = DangerText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        active.items.forEach { item ->
            val se = item.exercise
            val isSub = se.performedExerciseKey != se.originalExerciseKey
            val prog = item.progression

            IronCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                        Text(
                            text = se.performedExerciseName,
                            color = TextPrimary,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp
                        )
                        Text(
                            text = "${se.targetSets}×${se.repMin}–${se.repMax} reps • Descanso ${se.defaultRestSec}s",
                            color = TextMuted,
                            fontSize = 12.sp
                        )
                        if (isSub) {
                            Text(
                                text = "Original: ${se.originalExerciseName}",
                                color = Lime,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                    IronSecondaryButton(
                        text = "Substituir exercício",
                        onClick = { subTarget = item },
                        compact = true
                    )
                }

                // Dupla Progressão
                Spacer(Modifier.height(8.dp))
                Surface(
                    shape = RoundedCornerShape(9.dp),
                    color = if (prog.shouldIncrease) LimeDim else Surface3,
                    border = BorderStroke(1.dp, if (prog.shouldIncrease) LimeBorder else BorderSubtle),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = when {
                            !prog.hasHistory -> "Sem histórico prévio para ${se.performedExerciseName}."
                            prog.shouldIncrease -> "▲ Dupla progressão atingida! Sugestão: aumentar carga (última máx: ${IronLogViewModel.formatKg(prog.lastWeightKg)} kg)."
                            else -> "Última (${se.performedExerciseName}): ${prog.summary}"
                        },
                        color = if (prog.shouldIncrease) Lime else TextMuted,
                        fontSize = 12.sp,
                        fontWeight = if (prog.shouldIncrease) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)
                    )
                }

                // Cartões de séries
                item.sets.forEach { setLog ->
                    SetLogCard(
                        setLog = setLog,
                        repPlaceholder = "${se.repMin}-${se.repMax}",
                        weightPlaceholder = if (prog.hasHistory) IronLogViewModel.formatKg(prog.lastWeightKg) else "0",
                        canDelete = item.sets.size > 1,
                        activeTimer = activeTimer,
                        timerRemainingSec = timerRemainingSec,
                        onStartTimer = { plannedSec -> onStartSetTimer(setLog, plannedSec) },
                        onTogglePauseTimer = onTogglePauseTimer,
                        onRestartTimer = onRestartTimer,
                        onSkipTimer = onSkipTimer,
                        onUpdate = onUpdateSet,
                        onToggleDone = { onToggleSetDone(setLog.id) },
                        onDelete = { onDeleteSet(setLog.id) }
                    )
                }

                Spacer(Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
                        .clickable { onAddSet(se.id) }
                        .padding(vertical = 9.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("+ Adicionar série", color = TextMuted, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }
    }

    // Modal de substituição de exercício
    val target = subTarget
    if (target != null) {
        val se = target.exercise
        val options = buildList {
            add(
                AlternativeOption(
                    key = se.originalExerciseKey,
                    name = se.originalExerciseName,
                    defaultRestSec = se.defaultRestSec
                )
            )
            addAll(WorkoutSeed.decodeAlternatives(se.alternativesJson))
        }.distinctBy { it.key }

        AlertDialog(
            onDismissRequest = { subTarget = null },
            containerColor = Surface1,
            title = {
                Text("Substituir exercício", color = TextPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Original da ficha: ${se.originalExerciseName}. O histórico de cada variação é mantido separado.",
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                    options.forEachIndexed { idx, opt ->
                        val isCurrent = opt.key == se.performedExerciseKey
                        val label = if (idx == 0) "${opt.name} (Original)" else opt.name
                        Surface(
                            shape = RoundedCornerShape(11.dp),
                            color = Surface2,
                            border = BorderStroke(1.dp, if (isCurrent) Lime else BorderSubtle),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onSubstituteExercise(se.id, opt)
                                    subTarget = null
                                }
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(label, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text("Descanso sugerido: ${opt.defaultRestSec}s", color = TextMuted, fontSize = 12.sp)
                                }
                                IronBadge(text = if (isCurrent) "Atual" else "Escolher", accent = isCurrent)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { subTarget = null }) {
                    Text("Fechar", color = TextMuted)
                }
            }
        )
    }

    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            containerColor = Surface1,
            title = { Text("Descartar treino?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("Os registros desta sessão em andamento serão apagados.", color = TextMuted) },
            confirmButton = {
                TextButton(onClick = {
                    confirmDiscard = false
                    onDiscardSession()
                }) {
                    Text("Descartar", color = DangerText, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDiscard = false }) {
                    Text("Cancelar", color = TextMuted)
                }
            }
        )
    }

    if (confirmFinishEmpty) {
        AlertDialog(
            onDismissRequest = { confirmFinishEmpty = false },
            containerColor = Surface1,
            title = { Text("Finalizar treino?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("Nenhuma série foi marcada como concluída. Deseja finalizar mesmo assim?", color = TextMuted) },
            confirmButton = {
                TextButton(onClick = {
                    confirmFinishEmpty = false
                    onFinishSession()
                }) {
                    Text("Finalizar", color = Lime, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmFinishEmpty = false }) {
                    Text("Continuar treinando", color = TextMuted)
                }
            }
        )
    }
}

@Composable
fun SetLogCard(
    setLog: SetLogEntity,
    repPlaceholder: String,
    weightPlaceholder: String,
    canDelete: Boolean,
    activeTimer: RestTimerState? = null,
    timerRemainingSec: Int = 0,
    onStartTimer: ((plannedSec: Int) -> Unit)? = null,
    onTogglePauseTimer: (() -> Unit)? = null,
    onRestartTimer: (() -> Unit)? = null,
    onSkipTimer: (() -> Unit)? = null,
    onUpdate: (setId: String, weightKg: Double?, reps: Int?, rir: Int?, plannedRestSec: Int) -> Unit,
    onToggleDone: () -> Unit,
    onDelete: () -> Unit
) {
    var weightText by remember(setLog.id, setLog.weightKg) {
        mutableStateOf(setLog.weightKg?.let { IronLogViewModel.formatKg(it) } ?: "")
    }
    var repsText by remember(setLog.id, setLog.reps) {
        mutableStateOf(setLog.reps?.toString() ?: "")
    }
    var restText by remember(setLog.id, setLog.plannedRestSec) {
        mutableStateOf(setLog.plannedRestSec.toString())
    }

    fun pushValues(
        w: String = weightText,
        r: String = repsText,
        rest: String = restText,
        rir: Int? = setLog.rir
    ) {
        val parsedW = w.replace(',', '.').toDoubleOrNull()
        val parsedR = r.toIntOrNull()
        val parsedRest = rest.toIntOrNull() ?: setLog.plannedRestSec
        onUpdate(setLog.id, parsedW, parsedR, rir, parsedRest)
    }

    val effectiveRestSec = (restText.toIntOrNull()?.takeIf { it >= 10 }?.coerceAtMost(600))
        ?: setLog.plannedRestSec.coerceIn(10, 600)
    val isTimerActive = activeTimer?.setId == setLog.id
    val timerPct = if (isTimerActive && activeTimer != null) {
        (timerRemainingSec.toFloat() / activeTimer.plannedSec.coerceAtLeast(1).toFloat()).coerceIn(0f, 1f)
    } else 0f

    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .clip(shape)
            .background(
                when {
                    isTimerActive -> Color(0x18A3E635)
                    setLog.completed -> Color(0x0FA3E635)
                    else -> Surface2
                }
            )
            .border(
                width = 1.dp,
                color = when {
                    isTimerActive -> Lime
                    setLog.completed -> LimeBorder
                    else -> BorderSubtle
                },
                shape = shape
            )
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Série ${setLog.setNumber}",
                    color = TextPrimary,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 13.sp
                )
                if (setLog.actualRestSec != null) {
                    Text(
                        text = " (desc. ${setLog.actualRestSec}s)",
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (canDelete) {
                    TextButton(onClick = onDelete) {
                        Text("Remover", color = DangerText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
                if (setLog.completed) {
                    IronPrimaryButton(text = "✓ Concluída", onClick = onToggleDone, compact = true)
                } else {
                    IronSecondaryButton(text = "Concluir", onClick = onToggleDone, compact = true)
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            MiniNumericBox(
                label = "Carga (kg)",
                value = weightText,
                placeholder = weightPlaceholder,
                keyboardType = KeyboardType.Decimal,
                onValueChange = {
                    weightText = it
                    pushValues(w = it)
                },
                modifier = Modifier.weight(1f)
            )
            MiniNumericBox(
                label = "Repetições",
                value = repsText,
                placeholder = repPlaceholder,
                keyboardType = KeyboardType.Number,
                onValueChange = {
                    repsText = it
                    pushValues(r = it)
                },
                modifier = Modifier.weight(1f)
            )
            MiniNumericBox(
                label = "Descanso (s)",
                value = restText,
                placeholder = "90",
                keyboardType = KeyboardType.Number,
                onValueChange = {
                    restText = it
                    pushValues(rest = it)
                },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text("RIR", color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(2.dp))
            (0..5).forEach { rirVal ->
                val selected = setLog.rir == rirVal
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(7.dp))
                        .background(if (selected) Lime else BgBlack)
                        .border(1.dp, if (selected) Lime else BorderSubtle, RoundedCornerShape(7.dp))
                        .clickable {
                            val next = if (selected) null else rirVal
                            pushValues(rir = next)
                        }
                        .padding(vertical = 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = rirVal.toString(),
                        color = if (selected) BgBlack else TextMuted,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                }
            }
        }

        // Cronômetro de descanso integrado à série
        if (onStartTimer != null) {
            Spacer(Modifier.height(8.dp))
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(9.dp))
                    .background(BgBlack)
                    .border(
                        width = 1.dp,
                        color = if (isTimerActive) LimeBorder else BorderSubtle,
                        shape = RoundedCornerShape(9.dp)
                    )
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Timer,
                            contentDescription = "Cronômetro de descanso",
                            tint = if (isTimerActive) Lime else TextMuted,
                            modifier = Modifier.size(16.dp)
                        )
                        if (isTimerActive) {
                            Text(
                                text = IronLogViewModel.formatClock(timerRemainingSec),
                                color = Lime,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black
                            )
                            Text(
                                text = if (activeTimer?.isPaused == true) "Pausado" else "Descansando",
                                color = TextMuted,
                                fontSize = 11.sp
                            )
                        } else {
                            Text(
                                text = IronLogViewModel.formatClock(effectiveRestSec),
                                color = TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = setLog.actualRestSec?.let {
                                    "Real: ${IronLogViewModel.formatClock(it)}"
                                } ?: "Cronômetro",
                                color = TextMuted,
                                fontSize = 11.sp
                            )
                        }
                    }

                    if (isTimerActive) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(7.dp))
                                    .background(Surface2)
                                    .border(1.dp, BorderSubtle, RoundedCornerShape(7.dp))
                                    .clickable { onTogglePauseTimer?.invoke() }
                                    .padding(horizontal = 8.dp, vertical = 6.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = if (activeTimer?.isPaused == true) Icons.Filled.PlayArrow else Icons.Filled.Pause,
                                        contentDescription = if (activeTimer?.isPaused == true) "Retomar" else "Pausar",
                                        tint = TextPrimary,
                                        modifier = Modifier.size(13.dp)
                                    )
                                    Text(
                                        text = if (activeTimer?.isPaused == true) "Retomar" else "Pausar",
                                        color = TextPrimary,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(7.dp))
                                    .background(Surface2)
                                    .border(1.dp, BorderSubtle, RoundedCornerShape(7.dp))
                                    .clickable { onRestartTimer?.invoke() }
                                    .padding(horizontal = 7.dp, vertical = 6.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Refresh,
                                    contentDescription = "Reiniciar cronômetro",
                                    tint = TextPrimary,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(7.dp))
                                    .background(DangerDim)
                                    .border(1.dp, DangerBorder, RoundedCornerShape(7.dp))
                                    .clickable { onSkipTimer?.invoke() }
                                    .padding(horizontal = 8.dp, vertical = 6.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Filled.SkipNext,
                                        contentDescription = "Parar cronômetro",
                                        tint = DangerText,
                                        modifier = Modifier.size(13.dp)
                                    )
                                    Text(
                                        text = "Parar",
                                        color = DangerText,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(7.dp))
                                .background(Surface2)
                                .border(1.dp, BorderSubtle, RoundedCornerShape(7.dp))
                                .clickable {
                                    if (effectiveRestSec != setLog.plannedRestSec) {
                                        pushValues(rest = effectiveRestSec.toString())
                                    }
                                    onStartTimer(effectiveRestSec)
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.PlayArrow,
                                    contentDescription = "Iniciar cronômetro",
                                    tint = Lime,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = "Iniciar",
                                    color = Lime,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }

                if (isTimerActive) {
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
                                .fillMaxWidth(timerPct)
                                .height(4.dp)
                                .background(Lime)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MiniNumericBox(
    label: String,
    value: String,
    placeholder: String,
    keyboardType: KeyboardType,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            color = TextMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 3.dp)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(BgBlack)
                .border(1.dp, BorderSubtle, RoundedCornerShape(8.dp))
                .padding(vertical = 9.dp, horizontal = 6.dp),
            contentAlignment = Alignment.Center
        ) {
            if (value.isEmpty()) {
                Text(
                    text = placeholder,
                    color = Color(0xFF52525B),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                cursorBrush = SolidColor(Lime),
                textStyle = TextStyle(
                    color = TextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                ),
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
