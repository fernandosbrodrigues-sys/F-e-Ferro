package com.example.data

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

object WorkoutSeed {
    private data class SeedExercise(
        val key: String,
        val name: String,
        val targetSets: Int,
        val repMin: Int,
        val repMax: Int,
        val restMinSec: Int,
        val restMaxSec: Int,
        val defaultRestSec: Int,
        val isCompound: Boolean,
        val alternatives: List<AlternativeOption>
    )

    private data class SeedWorkout(
        val dayOfWeek: Int,
        val code: String,
        val name: String,
        val subtitle: String,
        val sortOrder: Int,
        val exercises: List<SeedExercise>
    )

    fun encodeAlternatives(list: List<AlternativeOption>): String {
        val arr = JSONArray()
        list.forEach { opt ->
            arr.put(
                JSONObject().apply {
                    put("key", opt.key)
                    put("name", opt.name)
                    put("defaultRestSec", opt.defaultRestSec)
                }
            )
        }
        return arr.toString()
    }

    fun decodeAlternatives(json: String): List<AlternativeOption> {
        return try {
            val arr = JSONArray(json)
            buildList {
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    add(
                        AlternativeOption(
                            key = obj.getString("key"),
                            name = obj.getString("name"),
                            defaultRestSec = obj.optInt("defaultRestSec", 90)
                        )
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private val defaultDaysByCode = mapOf(
        "UPPER_A" to 1,
        "LOWER_A" to 2,
        "UPPER_B" to 4,
        "LOWER_B" to 5
    )

    fun dayPrefixPt(dayOfWeek: Int): String = when (dayOfWeek) {
        1 -> "SEGUNDA"
        2 -> "TERÇA"
        3 -> "QUARTA"
        4 -> "QUINTA"
        5 -> "SEXTA"
        6 -> "SÁBADO"
        else -> "DOMINGO"
    }

    fun formatWorkoutNameForDay(dayOfWeek: Int, code: String): String {
        return "${dayPrefixPt(dayOfWeek)} – ${code.replace("_", " ")}"
    }

    fun buildSlotsFromWorkouts(workouts: List<WorkoutEntity>): Map<Int, WorkoutEntity?> {
        val slots = (1..7).associateWith { null as WorkoutEntity? }.toMutableMap()
        workouts.forEach { wk ->
            if (wk.dayOfWeek in 1..7) {
                slots[wk.dayOfWeek] = wk
            }
        }
        return slots
    }

    fun setDayAsRest(slots: Map<Int, WorkoutEntity?>, day: Int): Map<Int, WorkoutEntity?> {
        if (slots[day] == null) return slots
        val next = slots.toMutableMap()
        var moving: WorkoutEntity? = next[day]
        next[day] = null

        var cur = (day % 7) + 1
        var steps = 0
        while (steps < 7 && moving != null) {
            val displaced = next[cur]
            next[cur] = moving
            moving = displaced
            cur = (cur % 7) + 1
            steps++
        }
        return next
    }

    fun setDayAsTraining(slots: Map<Int, WorkoutEntity?>, day: Int): Map<Int, WorkoutEntity?> {
        if (slots[day] != null) return slots
        val next = slots.toMutableMap()

        var firstWkDay: Int? = null
        var cur = (day % 7) + 1
        for (i in 0 until 7) {
            if (next[cur] != null) {
                firstWkDay = cur
                break
            }
            cur = (cur % 7) + 1
        }
        if (firstWkDay == null) return slots

        var writeDay = day
        var readDay = firstWkDay
        for (i in 0 until 7) {
            val wk = next[readDay] ?: break
            next[writeDay] = wk
            next[readDay] = null
            writeDay = readDay
            readDay = (readDay % 7) + 1
            if (next[readDay] == null) break
        }
        return next
    }

    fun shiftAllByOneDay(slots: Map<Int, WorkoutEntity?>, delta: Int): Map<Int, WorkoutEntity?> {
        val next = (1..7).associateWith { null as WorkoutEntity? }.toMutableMap()
        for (d in 1..7) {
            val target = if (delta >= 0) (d % 7) + 1 else ((d - 2 + 7) % 7) + 1
            next[target] = slots[d]
        }
        return next
    }

    fun resetDefaultSlots(workouts: List<WorkoutEntity>): Map<Int, WorkoutEntity?> {
        val next = (1..7).associateWith { null as WorkoutEntity? }.toMutableMap()
        workouts.forEach { wk ->
            val defDay = defaultDaysByCode[wk.code] ?: wk.dayOfWeek
            next[defDay] = wk
        }
        return next
    }

    private val defaultSplit = listOf(
        SeedWorkout(
            dayOfWeek = 1,
            code = "UPPER_A",
            name = "SEGUNDA – UPPER A",
            subtitle = "Superiores A (Força e Hipertrofia)",
            sortOrder = 1,
            exercises = listOf(
                SeedExercise(
                    key = "supino_reto_barra",
                    name = "Supino reto com barra",
                    targetSets = 3, repMin = 6, repMax = 10,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 150, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("supino_reto_halteres", "Supino reto com halteres", 150),
                        AlternativeOption("supino_reto_maquina", "Supino reto na máquina", 120)
                    )
                ),
                SeedExercise(
                    key = "supino_inclinado_halteres",
                    name = "Supino inclinado com halteres",
                    targetSets = 2, repMin = 8, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 150, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("supino_inclinado_maquina", "Supino inclinado na máquina", 120),
                        AlternativeOption("supino_inclinado_barra", "Supino inclinado com barra", 150)
                    )
                ),
                SeedExercise(
                    key = "puxada_alta",
                    name = "Puxada alta",
                    targetSets = 3, repMin = 8, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 120, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("puxada_articulada", "Puxada articulada", 120),
                        AlternativeOption("barra_fixa_graviton", "Barra fixa no graviton", 120)
                    )
                ),
                SeedExercise(
                    key = "remada_baixa",
                    name = "Remada baixa",
                    targetSets = 3, repMin = 8, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 120, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("remada_articulada", "Remada articulada", 120),
                        AlternativeOption("remada_curvada_barra", "Remada curvada com barra", 150)
                    )
                ),
                SeedExercise(
                    key = "elevacao_lateral",
                    name = "Elevação lateral",
                    targetSets = 3, repMin = 12, repMax = 20,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 90, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("elevacao_lateral_polia", "Elevação lateral na polia", 90),
                        AlternativeOption("elevacao_lateral_maquina", "Elevação lateral na máquina", 75)
                    )
                ),
                SeedExercise(
                    key = "rosca_direta",
                    name = "Rosca direta",
                    targetSets = 2, repMin = 8, repMax = 12,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 90, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("rosca_direta_polia", "Rosca direta na polia", 75),
                        AlternativeOption("rosca_alternada_halteres", "Rosca alternada com halteres", 90)
                    )
                ),
                SeedExercise(
                    key = "triceps_corda",
                    name = "Tríceps corda",
                    targetSets = 2, repMin = 10, repMax = 15,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 75, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("triceps_barra_polia", "Tríceps barra reta na polia", 75),
                        AlternativeOption("triceps_testa_barra_w", "Tríceps testa com barra W", 90)
                    )
                )
            )
        ),
        SeedWorkout(
            dayOfWeek = 2,
            code = "LOWER_A",
            name = "TERÇA – LOWER A",
            subtitle = "Inferiores A (Quadríceps e Posterior)",
            sortOrder = 2,
            exercises = listOf(
                SeedExercise(
                    key = "leg_press",
                    name = "Leg press",
                    targetSets = 3, repMin = 6, repMax = 10,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 150, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("hack_squat", "Hack squat", 150),
                        AlternativeOption("agachamento_smith", "Agachamento Smith", 150)
                    )
                ),
                SeedExercise(
                    key = "cadeira_extensora",
                    name = "Cadeira extensora",
                    targetSets = 2, repMin = 10, repMax = 15,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 90, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("extensora_unilateral", "Cadeira extensora unilateral", 75),
                        AlternativeOption("agachamento_sissy", "Agachamento sissy", 90)
                    )
                ),
                SeedExercise(
                    key = "cadeira_flexora",
                    name = "Cadeira flexora",
                    targetSets = 3, repMin = 8, repMax = 10,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 90, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("mesa_flexora", "Mesa flexora", 90),
                        AlternativeOption("flexora_em_pe", "Flexora em pé unilateral", 75)
                    )
                ),
                SeedExercise(
                    key = "stiff",
                    name = "Stiff",
                    targetSets = 2, repMin = 10, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 150, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("rdl_halteres", "RDL com halteres", 150),
                        AlternativeOption("stiff_smith", "Stiff no Smith", 120)
                    )
                ),
                SeedExercise(
                    key = "elevacao_pelvica",
                    name = "Elevação pélvica",
                    targetSets = 3, repMin = 8, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 120, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("hip_thrust_maquina", "Hip thrust na máquina", 120),
                        AlternativeOption("ponte_gluteo_barra", "Ponte de glúteo com barra", 120)
                    )
                ),
                SeedExercise(
                    key = "panturrilha",
                    name = "Panturrilha",
                    targetSets = 4, repMin = 12, repMax = 20,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 60, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("panturrilha_leg_press", "Panturrilha no leg press", 60),
                        AlternativeOption("panturrilha_smith", "Panturrilha no Smith", 60)
                    )
                )
            )
        ),
        SeedWorkout(
            dayOfWeek = 4,
            code = "UPPER_B",
            name = "QUINTA – UPPER B",
            subtitle = "Superiores B (Volume e Detalhes)",
            sortOrder = 3,
            exercises = listOf(
                SeedExercise(
                    key = "supino_inclinado_maquina",
                    name = "Supino inclinado na máquina",
                    targetSets = 3, repMin = 8, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 120, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("supino_inclinado_halteres", "Supino inclinado com halteres", 150),
                        AlternativeOption("supino_inclinado_smith", "Supino inclinado no Smith", 120)
                    )
                ),
                SeedExercise(
                    key = "crucifixo_polia",
                    name = "Crucifixo na polia",
                    targetSets = 2, repMin = 12, repMax = 15,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 90, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("peck_deck", "Peck deck (voador)", 75),
                        AlternativeOption("crucifixo_halteres", "Crucifixo com halteres", 90)
                    )
                ),
                SeedExercise(
                    key = "puxada_alta_neutra",
                    name = "Puxada alta pegada neutra",
                    targetSets = 3, repMin = 8, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 120, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("puxada_articulada_neutra", "Puxada articulada neutra", 120),
                        AlternativeOption("puxada_alta_supinada", "Puxada alta supinada", 120)
                    )
                ),
                SeedExercise(
                    key = "remada_articulada",
                    name = "Remada articulada",
                    targetSets = 3, repMin = 8, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 120, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("remada_cavalinho", "Remada cavalinho", 150),
                        AlternativeOption("remada_unilateral_halter", "Remada unilateral com halter", 120)
                    )
                ),
                SeedExercise(
                    key = "desenvolvimento_halteres",
                    name = "Desenvolvimento com halteres",
                    targetSets = 2, repMin = 8, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 120, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("desenvolvimento_maquina", "Desenvolvimento na máquina", 120),
                        AlternativeOption("desenvolvimento_barra", "Desenvolvimento militar com barra", 150)
                    )
                ),
                SeedExercise(
                    key = "crucifixo_inverso",
                    name = "Crucifixo inverso",
                    targetSets = 2, repMin = 12, repMax = 20,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 75, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("crucifixo_inverso_polia", "Crucifixo inverso na polia", 75),
                        AlternativeOption("face_pull", "Face pull na polia", 75)
                    )
                ),
                SeedExercise(
                    key = "rosca_scott",
                    name = "Rosca Scott",
                    targetSets = 3, repMin = 10, repMax = 12,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 90, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("rosca_scott_maquina", "Rosca Scott na máquina", 75),
                        AlternativeOption("rosca_concentrada", "Rosca concentrada", 75)
                    )
                ),
                SeedExercise(
                    key = "triceps_frances",
                    name = "Tríceps francês",
                    targetSets = 3, repMin = 10, repMax = 15,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 75, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("triceps_frances_polia", "Tríceps francês na polia", 75),
                        AlternativeOption("triceps_testa_halteres", "Tríceps testa com halteres", 90)
                    )
                )
            )
        ),
        SeedWorkout(
            dayOfWeek = 5,
            code = "LOWER_B",
            name = "SEXTA – LOWER B",
            subtitle = "Inferiores B (Posterior e Glúteos)",
            sortOrder = 4,
            exercises = listOf(
                SeedExercise(
                    key = "agachamento_bulgaro",
                    name = "Agachamento búlgaro",
                    targetSets = 2, repMin = 10, repMax = 12,
                    restMinSec = 120, restMaxSec = 180, defaultRestSec = 150, isCompound = true,
                    alternatives = listOf(
                        AlternativeOption("afundo_smith", "Afundo no Smith", 120),
                        AlternativeOption("passada_halteres", "Passada com halteres", 120)
                    )
                ),
                SeedExercise(
                    key = "cadeira_extensora",
                    name = "Cadeira extensora",
                    targetSets = 2, repMin = 12, repMax = 15,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 90, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("extensora_unilateral", "Cadeira extensora unilateral", 75),
                        AlternativeOption("agachamento_sissy", "Agachamento sissy", 90)
                    )
                ),
                SeedExercise(
                    key = "cadeira_flexora",
                    name = "Cadeira flexora",
                    targetSets = 3, repMin = 10, repMax = 15,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 90, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("mesa_flexora", "Mesa flexora", 90),
                        AlternativeOption("flexora_em_pe", "Flexora em pé unilateral", 75)
                    )
                ),
                SeedExercise(
                    key = "mesa_flexora",
                    name = "Mesa flexora",
                    targetSets = 2, repMin = 10, repMax = 15,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 90, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("cadeira_flexora", "Cadeira flexora", 90),
                        AlternativeOption("stiff_halteres", "Stiff com halteres", 120)
                    )
                ),
                SeedExercise(
                    key = "abdutora",
                    name = "Abdutora",
                    targetSets = 2, repMin = 12, repMax = 20,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 75, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("abducao_polia", "Abdução na polia", 60),
                        AlternativeOption("abducao_elastico", "Abdução com elástico", 60)
                    )
                ),
                SeedExercise(
                    key = "panturrilha_sentado",
                    name = "Panturrilha sentado",
                    targetSets = 3, repMin = 12, repMax = 20,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 60, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("panturrilha_em_pe", "Panturrilha em pé na máquina", 60),
                        AlternativeOption("panturrilha_leg_press", "Panturrilha no leg press", 60)
                    )
                ),
                SeedExercise(
                    key = "abdominal_polia",
                    name = "Abdominal na polia",
                    targetSets = 2, repMin = 12, repMax = 15,
                    restMinSec = 60, restMaxSec = 120, defaultRestSec = 75, isCompound = false,
                    alternatives = listOf(
                        AlternativeOption("abdominal_infra_barra", "Abdominal infra na barra", 75),
                        AlternativeOption("abdominal_maquina", "Abdominal na máquina", 60)
                    )
                )
            )
        )
    )

    fun buildForUser(userId: String): Pair<List<WorkoutEntity>, List<ExerciseEntity>> {
        val workouts = mutableListOf<WorkoutEntity>()
        val exercises = mutableListOf<ExerciseEntity>()
        defaultSplit.forEach { sw ->
            val workoutId = UUID.randomUUID().toString()
            workouts += WorkoutEntity(
                id = workoutId,
                userId = userId,
                dayOfWeek = sw.dayOfWeek,
                code = sw.code,
                name = sw.name,
                subtitle = sw.subtitle,
                sortOrder = sw.sortOrder
            )
            sw.exercises.forEachIndexed { idx, ex ->
                exercises += ExerciseEntity(
                    id = UUID.randomUUID().toString(),
                    userId = userId,
                    workoutId = workoutId,
                    exerciseKey = ex.key,
                    name = ex.name,
                    targetSets = ex.targetSets,
                    repMin = ex.repMin,
                    repMax = ex.repMax,
                    restMinSec = ex.restMinSec,
                    restMaxSec = ex.restMaxSec,
                    defaultRestSec = ex.defaultRestSec,
                    isCompound = ex.isCompound,
                    alternativesJson = encodeAlternatives(ex.alternatives),
                    sortOrder = idx + 1
                )
            }
        }
        return workouts to exercises
    }
}
