import { useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react';
import type {
  ActiveSessionItem,
  ActiveSessionPayload,
  AlternativeOption,
  Exercise,
  RestTimerState,
  SetLog,
  SetLogPatch,
  Workout,
  WorkoutSession,
} from '../types.ts';
import { computeProgression, formatClock, formatKg, getDayNamePt } from '../utils/training.ts';

interface WorkoutsViewProps {
  workouts: Workout[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  setLogs: SetLog[];
  activeSession: ActiveSessionPayload | null;
  activeTimer: RestTimerState | null;
  timerRemainingSec: number;
  onStartWorkout: (workoutId: string) => void;
  onOpenScheduleConfig: () => void;
  onStartTimer: (setLog: SetLog, plannedSec: number) => void;
  onTogglePauseTimer: () => void;
  onRestartTimer: () => void;
  onSkipTimer: () => void;
  onUpdateSet: (setId: string, patch: SetLogPatch) => Promise<void>;
  onToggleSetDone: (setLog: SetLog) => Promise<void>;
  onAddSet: (sessionExerciseId: string) => Promise<void>;
  onDeleteSet: (setId: string) => Promise<void>;
  onSubstituteExercise: (
    sessionExerciseId: string,
    option: AlternativeOption
  ) => Promise<void>;
  onFinishSession: (sessionId: string) => Promise<void>;
  onDiscardSession: (sessionId: string) => Promise<void>;
}

export function WorkoutsView({
  workouts,
  exercises,
  sessions,
  setLogs,
  activeSession,
  activeTimer,
  timerRemainingSec,
  onStartWorkout,
  onOpenScheduleConfig,
  onStartTimer,
  onTogglePauseTimer,
  onRestartTimer,
  onSkipTimer,
  onUpdateSet,
  onToggleSetDone,
  onAddSet,
  onDeleteSet,
  onSubstituteExercise,
  onFinishSession,
  onDiscardSession,
}: WorkoutsViewProps) {
  const [subTarget, setSubTarget] = useState<ActiveSessionItem | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmEmptyFinish, setConfirmEmptyFinish] = useState(false);

  const sortedWorkouts = workouts.slice().sort((a, b) => a.day_of_week - b.day_of_week);
  const restDays = [1, 2, 3, 4, 5, 6, 7].filter(
    (d) => !sortedWorkouts.some((w) => w.day_of_week === d)
  );
  const restDaysText =
    restDays.length === 0
      ? 'Nenhum dia de descanso'
      : restDays.length === 1
      ? getDayNamePt(restDays[0])
      : `${restDays
          .slice(0, -1)
          .map((d) => getDayNamePt(d))
          .join(', ')} e ${getDayNamePt(restDays[restDays.length - 1])}`;

  if (!activeSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              className="text-xl font-extrabold tracking-tight text-[#f4f4f5]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Ficha de Treinamento
            </h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">4 dias · Hipertrofia</p>
          </div>
          <button
            type="button"
            onClick={onOpenScheduleConfig}
            className="min-h-[40px] px-3.5 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] text-xs font-bold text-[#a3e635] rounded-xl cursor-pointer whitespace-nowrap"
          >
            Configurar descanso
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedWorkouts.map((wk) => {
            const wkExs = exercises
              .filter((e) => e.workout_id === wk.id)
              .sort((a, b) => a.sort_order - b.sort_order);

            return (
              <div
                key={wk.id}
                className="bg-[#121215] border border-[#27272e] rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#f4f4f5]">{wk.name}</h3>
                      <p className="text-xs text-[#9ca3af] mt-0.5">{wk.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStartWorkout(wk.id)}
                      className="min-h-[40px] px-4 bg-[#a3e635] hover:bg-[#bef264] text-[#09090b] font-bold text-xs rounded-xl shrink-0 cursor-pointer whitespace-nowrap"
                    >
                      Iniciar
                    </button>
                  </div>

                  <div className="border-t border-[#27272e] pt-2.5 divide-y divide-[#27272e]/60">
                    {wkExs.map((ex) => (
                      <div
                        key={ex.id}
                        className="py-2 flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-[#f4f4f5]">{ex.name}</span>
                        <span className="text-xs text-[#9ca3af] font-mono tabular-nums shrink-0">
                          {ex.target_sets}×{ex.rep_min}–{ex.rep_max} · {ex.default_rest_sec}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-sm text-[#f4f4f5]">{restDaysText}</p>
            <p className="text-xs text-[#9ca3af] mt-0.5">Dias programados de descanso.</p>
          </div>
          <button
            type="button"
            onClick={onOpenScheduleConfig}
            className="min-h-[38px] px-3 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] text-xs font-bold text-[#f4f4f5] rounded-xl shrink-0 cursor-pointer whitespace-nowrap"
          >
            Alterar
          </button>
        </div>
      </div>
    );
  }

  const allSets = activeSession.items.flatMap((i) => i.sets);
  const doneCount = allSets.filter((s) => s.completed === 1).length;

  return (
    <div className="space-y-4">
      <div className="bg-[#121215] border border-[#a3e635]/50 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#a3e635] font-mono tabular-nums">
              Treino ativo · {doneCount}/{allSets.length} séries
            </p>
            <h2
              className="text-2xl font-extrabold tracking-tight text-[#f4f4f5] mt-0.5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {activeSession.session.workout_name}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              if (doneCount === 0) setConfirmEmptyFinish(true);
              else onFinishSession(activeSession.session.id);
            }}
            className="min-h-[44px] px-4 bg-[#a3e635] hover:bg-[#bef264] text-[#09090b] font-bold text-sm rounded-xl shrink-0 cursor-pointer"
          >
            Finalizar
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#27272e]">
          <span className="text-xs text-[#9ca3af]">As séries são salvas automaticamente.</span>
          <button
            type="button"
            onClick={() => setConfirmDiscard(true)}
            className="text-xs font-semibold text-[#fca5a5] hover:underline px-2 py-1 cursor-pointer"
          >
            Descartar treino
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {activeSession.items.map((item) => {
          const se = item.exercise;
          const isSub = se.performed_exercise_key !== se.original_exercise_key;
          const prog = computeProgression(
            se.performed_exercise_key,
            se.target_sets,
            se.rep_max,
            sessions,
            setLogs
          );

          return (
            <div
              key={se.id}
              className="bg-[#121215] border border-[#27272e] rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#f4f4f5]">
                    {se.performed_exercise_name}
                  </h3>
                  <p className="text-xs text-[#9ca3af] font-mono tabular-nums mt-0.5">
                    {se.target_sets}×{se.rep_min}–{se.rep_max} reps · Descanso {se.default_rest_sec}s
                  </p>
                  {isSub && (
                    <p className="text-xs text-[#a3e635] mt-0.5">
                      Original da ficha: {se.original_exercise_name}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSubTarget(item)}
                  className="min-h-[40px] px-3 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] text-xs font-bold text-[#f4f4f5] rounded-xl shrink-0 cursor-pointer whitespace-nowrap"
                >
                  Substituir exercício
                </button>
              </div>

              {/* Dupla Progressão */}
              <div
                className={`mt-3 rounded-xl px-3 py-2.5 text-xs border ${
                  prog.shouldIncrease
                    ? 'bg-[#a3e635]/12 border-[#a3e635]/45 text-[#a3e635] font-semibold'
                    : 'bg-[#18181c] border-[#27272e] text-[#9ca3af]'
                }`}
              >
                {!prog.hasHistory
                  ? `Sem histórico prévio para ${se.performed_exercise_name}.`
                  : prog.shouldIncrease
                  ? `▲ Dupla progressão atingida! Sugestão: aumentar carga (última máx: ${formatKg(
                      prog.lastWeightKg
                    )} kg).`
                  : `Última (${se.performed_exercise_name}): ${prog.summary}`}
              </div>

              <div className="mt-3 space-y-2.5">
                {item.sets
                  .slice()
                  .sort((a, b) => a.set_number - b.set_number)
                  .map((s) => (
                    <SetCard
                      key={s.id}
                      setLog={s}
                      repPlaceholder={`${se.rep_min}-${se.rep_max}`}
                      weightPlaceholder={prog.hasHistory ? formatKg(prog.lastWeightKg) : '0'}
                      canDelete={item.sets.length > 1}
                      activeTimer={activeTimer}
                      timerRemainingSec={timerRemainingSec}
                      onStartTimer={onStartTimer}
                      onTogglePauseTimer={onTogglePauseTimer}
                      onRestartTimer={onRestartTimer}
                      onSkipTimer={onSkipTimer}
                      onUpdate={onUpdateSet}
                      onToggleDone={() => onToggleSetDone(s)}
                      onDelete={() => onDeleteSet(s.id)}
                    />
                  ))}
              </div>

              <button
                type="button"
                onClick={() => onAddSet(se.id)}
                className="w-full min-h-[42px] mt-3 border border-dashed border-[#27272e] hover:border-[#a3e635]/50 text-xs font-bold text-[#9ca3af] hover:text-[#f4f4f5] rounded-xl cursor-pointer transition-colors"
              >
                + Adicionar série
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal Substituir Exercício */}
      {subTarget && (
        <SubstituteModal
          item={subTarget}
          onClose={() => setSubTarget(null)}
          onSelect={async (opt) => {
            await onSubstituteExercise(subTarget.exercise.id, opt);
            setSubTarget(null);
          }}
        />
      )}

      {/* Confirm Discard */}
      {confirmDiscard && (
        <ConfirmDialog
          title="Descartar treino?"
          body="Os registros desta sessão em andamento serão apagados permanentemente."
          confirmLabel="Descartar"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={async () => {
            setConfirmDiscard(false);
            await onDiscardSession(activeSession.session.id);
          }}
        />
      )}

      {/* Confirm Finish Empty */}
      {confirmEmptyFinish && (
        <ConfirmDialog
          title="Finalizar treino?"
          body="Nenhuma série foi marcada como concluída. Deseja finalizar mesmo assim?"
          confirmLabel="Finalizar"
          onCancel={() => setConfirmEmptyFinish(false)}
          onConfirm={async () => {
            setConfirmEmptyFinish(false);
            await onFinishSession(activeSession.session.id);
          }}
        />
      )}
    </div>
  );
}

export function SetCard({
  setLog,
  repPlaceholder,
  weightPlaceholder,
  canDelete,
  activeTimer,
  timerRemainingSec = 0,
  onStartTimer,
  onTogglePauseTimer,
  onRestartTimer,
  onSkipTimer,
  onUpdate,
  onToggleDone,
  onDelete,
}: {
  setLog: SetLog;
  repPlaceholder: string;
  weightPlaceholder: string;
  canDelete: boolean;
  activeTimer?: RestTimerState | null;
  timerRemainingSec?: number;
  onStartTimer?: (setLog: SetLog, plannedSec: number) => void;
  onTogglePauseTimer?: () => void;
  onRestartTimer?: () => void;
  onSkipTimer?: () => void;
  onUpdate: (setId: string, patch: SetLogPatch) => Promise<void>;
  onToggleDone: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [weight, setWeight] = useState(
    setLog.weight_kg !== null && setLog.weight_kg !== undefined ? String(setLog.weight_kg) : ''
  );
  const [reps, setReps] = useState(
    setLog.reps !== null && setLog.reps !== undefined ? String(setLog.reps) : ''
  );
  const [rest, setRest] = useState(String(setLog.planned_rest_sec));

  const done = setLog.completed === 1;
  const parsedRest = Math.round(Number(rest.trim()));
  const effectiveRestSec =
    Number.isFinite(parsedRest) && parsedRest >= 10
      ? Math.min(600, parsedRest)
      : setLog.planned_rest_sec || 90;
  const isTimerActive = Boolean(activeTimer && activeTimer.setId === setLog.id);
  const timerPct = isTimerActive && activeTimer
    ? Math.min(100, Math.max(0, (timerRemainingSec / Math.max(1, activeTimer.plannedSec)) * 100))
    : 0;

  const commitField = (patch: SetLogPatch) => {
    void onUpdate(setLog.id, patch);
  };

  return (
    <div
      className={`rounded-xl p-3 border transition-colors ${
        isTimerActive
          ? 'bg-[#a3e635]/[0.1] border-[#a3e635]'
          : done
          ? 'bg-[#a3e635]/[0.07] border-[#a3e635]/50'
          : 'bg-[#18181c] border-[#27272e]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-[#f4f4f5] font-mono tabular-nums">
          Série {setLog.set_number}
          {setLog.actual_rest_sec !== null && (
            <span className="text-[#9ca3af] font-normal ml-2">
              (desc. {setLog.actual_rest_sec}s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={() => void onDelete()}
              className="px-2 py-1.5 text-xs font-semibold text-[#fca5a5] hover:underline cursor-pointer"
            >
              Remover
            </button>
          )}
          <button
            type="button"
            onClick={() => void onToggleDone()}
            className={`min-h-[38px] px-3.5 text-xs font-bold rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
              done
                ? 'bg-[#a3e635] text-[#09090b]'
                : 'bg-[#121215] hover:bg-[#222228] border border-[#27272e] text-[#f4f4f5]'
            }`}
          >
            {done ? '✓ Concluída' : 'Concluir'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <div>
          <label className="block text-[11px] text-[#9ca3af] font-semibold mb-1">
            Carga (kg)
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder={weightPlaceholder}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => {
              const trimmed = weight.trim().replace(',', '.');
              const parsed = trimmed === '' ? null : Number(trimmed);
              commitField({
                weight_kg: parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
              });
            }}
            className="w-full min-h-[40px] bg-[#09090b] border border-[#27272e] focus:border-[#a3e635] rounded-lg px-2 py-1.5 text-center text-sm font-bold font-mono tabular-nums text-[#f4f4f5] outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] text-[#9ca3af] font-semibold mb-1">
            Repetições
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder={repPlaceholder}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onBlur={() => {
              const trimmed = reps.trim();
              const parsed = trimmed === '' ? null : Math.round(Number(trimmed));
              commitField({
                reps: parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
              });
            }}
            className="w-full min-h-[40px] bg-[#09090b] border border-[#27272e] focus:border-[#a3e635] rounded-lg px-2 py-1.5 text-center text-sm font-bold font-mono tabular-nums text-[#f4f4f5] outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] text-[#9ca3af] font-semibold mb-1">
            Descanso (s)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
            onBlur={() => {
              const parsed = Math.round(Number(rest.trim()));
              if (Number.isFinite(parsed) && parsed >= 10) {
                commitField({ planned_rest_sec: Math.min(600, parsed) });
              }
            }}
            className="w-full min-h-[40px] bg-[#09090b] border border-[#27272e] focus:border-[#a3e635] rounded-lg px-2 py-1.5 text-center text-sm font-bold font-mono tabular-nums text-[#f4f4f5] outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2.5">
        <span className="text-[11px] font-bold text-[#9ca3af] mr-1">RIR</span>
        {[0, 1, 2, 3, 4, 5].map((r) => {
          const active = setLog.rir === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => commitField({ rir: active ? null : r })}
              className={`flex-1 min-h-[34px] rounded-lg text-xs font-bold font-mono tabular-nums cursor-pointer border transition-colors ${
                active
                  ? 'bg-[#a3e635] text-[#09090b] border-[#a3e635]'
                  : 'bg-[#09090b] text-[#9ca3af] border-[#27272e] hover:text-[#f4f4f5]'
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>

      {onStartTimer && (
        <div
          className={`mt-2.5 rounded-lg border px-2.5 py-2 ${
            isTimerActive
              ? 'bg-[#09090b] border-[#a3e635]/60'
              : 'bg-[#09090b]/80 border-[#27272e]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Timer
                className={`w-4 h-4 shrink-0 ${
                  isTimerActive ? 'text-[#a3e635]' : 'text-[#9ca3af]'
                }`}
              />
              {isTimerActive ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-extrabold text-[#a3e635] font-mono tabular-nums">
                    {formatClock(timerRemainingSec)}
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">
                    {activeTimer?.isPaused ? 'Pausado' : 'Descansando'}
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 truncate">
                  <span className="text-xs font-bold text-[#f4f4f5] font-mono tabular-nums">
                    {formatClock(effectiveRestSec)}
                  </span>
                  <span className="text-[11px] text-[#9ca3af] truncate">
                    {setLog.actual_rest_sec !== null
                      ? `Real: ${formatClock(setLog.actual_rest_sec)}`
                      : 'Cronômetro'}
                  </span>
                </div>
              )}
            </div>

            {isTimerActive ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onTogglePauseTimer}
                  aria-label={activeTimer?.isPaused ? 'Continuar cronômetro' : 'Pausar cronômetro'}
                  className="min-h-[32px] px-2.5 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] text-[#f4f4f5] text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer"
                >
                  {activeTimer?.isPaused ? (
                    <>
                      <Play className="w-3 h-3" />
                      Retomar
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3" />
                      Pausar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onRestartTimer}
                  aria-label="Reiniciar cronômetro"
                  className="min-h-[32px] px-2 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] text-[#f4f4f5] rounded-md flex items-center justify-center cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onSkipTimer}
                  aria-label="Concluir descanso"
                  className="min-h-[32px] px-2.5 bg-[#ef4444]/15 hover:bg-[#ef4444]/25 border border-[#ef4444]/40 text-[#fca5a5] text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer"
                >
                  <SkipForward className="w-3 h-3" />
                  Parar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (effectiveRestSec !== setLog.planned_rest_sec) {
                    commitField({ planned_rest_sec: effectiveRestSec });
                  }
                  onStartTimer(setLog, effectiveRestSec);
                }}
                className="min-h-[32px] px-3 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] hover:border-[#a3e635]/60 text-xs font-bold text-[#a3e635] rounded-md flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3 fill-current" />
                Iniciar
              </button>
            )}
          </div>

          {isTimerActive && (
            <div className="h-1 bg-[#222228] rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-[#a3e635] transition-[width] duration-200"
                style={{ width: `${timerPct}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubstituteModal({
  item,
  onClose,
  onSelect,
}: {
  item: ActiveSessionItem;
  onClose: () => void;
  onSelect: (option: AlternativeOption) => Promise<void>;
}) {
  const se = item.exercise;
  const options: Array<AlternativeOption & { isOriginal?: boolean }> = [
    {
      key: se.original_exercise_key,
      name: se.original_exercise_name,
      default_rest_sec: se.default_rest_sec,
      isOriginal: true,
    },
    ...se.alternatives.filter((a) => a.key !== se.original_exercise_key),
  ];

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#121215] border border-[#27272e] rounded-2xl p-4 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-base font-bold text-[#f4f4f5]">Substituir exercício</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-[#9ca3af] hover:text-[#f4f4f5] px-2 py-1 cursor-pointer"
          >
            Fechar
          </button>
        </div>
        <p className="text-xs text-[#9ca3af] mb-3">
          Original da ficha: <strong className="text-[#f4f4f5]">{se.original_exercise_name}</strong>.
          O histórico de cada variação é mantido separado.
        </p>

        <div className="space-y-2">
          {options.map((opt) => {
            const isCurrent = opt.key === se.performed_exercise_key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => void onSelect(opt)}
                className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  isCurrent
                    ? 'bg-[#a3e635]/10 border-[#a3e635]'
                    : 'bg-[#18181c] border-[#27272e] hover:border-[#3f3f46]'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-[#f4f4f5]">
                    {opt.name}
                    {opt.isOriginal ? ' (Original)' : ''}
                  </p>
                  <p className="text-xs text-[#9ca3af] font-mono tabular-nums mt-0.5">
                    Descanso sugerido: {opt.default_rest_sec}s
                  </p>
                </div>
                <span
                  className={`text-xs font-bold shrink-0 ${
                    isCurrent ? 'text-[#a3e635]' : 'text-[#9ca3af]'
                  }`}
                >
                  {isCurrent ? 'Atual' : 'Escolher'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-[#121215] border border-[#27272e] rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-[#f4f4f5]">{title}</h3>
        <p className="text-sm text-[#9ca3af] mt-1.5">{body}</p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] px-4 bg-[#18181c] border border-[#27272e] text-xs font-bold text-[#9ca3af] rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            className={`min-h-[40px] px-4 text-xs font-bold rounded-xl cursor-pointer ${
              danger
                ? 'bg-[#ef4444]/20 border border-[#ef4444]/50 text-[#fca5a5]'
                : 'bg-[#a3e635] text-[#09090b]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
