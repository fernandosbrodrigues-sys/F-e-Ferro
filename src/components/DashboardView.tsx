import type { ActiveSessionPayload, Workout, WorkoutSession } from '../types.ts';
import {
  formatDate,
  getDayNamePt,
  getDayShortPt,
  getIsoDayOfWeek,
  startOfWeekMs,
} from '../utils/training.ts';

interface DashboardViewProps {
  workouts: Workout[];
  sessions: WorkoutSession[];
  activeSession: ActiveSessionPayload | null;
  onResumeActive: () => void;
  onStartWorkout: (workoutId: string) => void;
  onOpenSessionDetail: (sessionId: string) => void;
  onOpenScheduleConfig: () => void;
}

export function DashboardView({
  workouts,
  sessions,
  activeSession,
  onResumeActive,
  onStartWorkout,
  onOpenSessionDetail,
  onOpenScheduleConfig,
}: DashboardViewProps) {
  const isoDay = getIsoDayOfWeek();
  const dayLabel = getDayNamePt(isoDay);
  const sortedWorkouts = workouts.slice().sort((a, b) => a.day_of_week - b.day_of_week);
  const todayWorkout = sortedWorkouts.find((w) => w.day_of_week === isoDay) || null;
  const activeDaysLabel = sortedWorkouts.map((w) => getDayShortPt(w.day_of_week)).join(' · ');

  const weekStart = startOfWeekMs();
  const weekMs = 7 * 24 * 3600 * 1000;
  const prevWeekStart = weekStart - weekMs;

  const completed = sessions.filter((s) => s.status === 'completed');
  const weekCompleted = completed.filter((s) => s.started_at >= weekStart);
  const weekVolume = weekCompleted.reduce((acc, s) => acc + Number(s.total_volume_kg || 0), 0);
  const prevWeekVol = completed
    .filter((s) => s.started_at >= prevWeekStart && s.started_at < weekStart)
    .reduce((acc, s) => acc + Number(s.total_volume_kg || 0), 0);

  const lastSession = completed[0] || null;

  let evolutionText = 'Registre treinos para acompanhar sua evolução.';
  if (completed.length > 0 && prevWeekVol > 0 && weekVolume > 0) {
    const pct = Math.round(((weekVolume - prevWeekVol) / prevWeekVol) * 100);
    evolutionText = `${pct >= 0 ? '+' : ''}${pct}% volume vs semana passada`;
  } else if (lastSession) {
    evolutionText = `${lastSession.workout_name} concluído`;
  }

  return (
    <div className="space-y-4">
      {activeSession && (
        <div className="bg-[#121215] border border-[#a3e635]/50 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#a3e635]">
              Treino em andamento · {formatDate(activeSession.session.started_at)}
            </p>
            <h2 className="text-base font-bold text-[#f4f4f5] truncate mt-0.5">
              {activeSession.session.workout_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onResumeActive}
            className="min-h-[44px] px-4 bg-[#a3e635] hover:bg-[#bef264] text-[#09090b] font-bold text-sm rounded-xl shrink-0 cursor-pointer transition-colors"
          >
            Retomar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Treino do dia */}
        <div
          className={`lg:col-span-7 bg-[#121215] rounded-2xl p-5 flex flex-col justify-between border ${
            !activeSession && todayWorkout ? 'border-[#a3e635]/45' : 'border-[#27272e]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#9ca3af] mb-2">
              <span className={todayWorkout ? 'text-[#a3e635] font-semibold' : ''}>
                {dayLabel}
              </span>
              <span className="font-mono tabular-nums">{formatDate(Date.now())}</span>
            </div>

            {todayWorkout ? (
              <>
                <h2
                  className="text-2xl font-extrabold tracking-tight text-[#f4f4f5]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {todayWorkout.name}
                </h2>
                <p className="text-sm text-[#9ca3af] mt-1">{todayWorkout.subtitle}</p>
              </>
            ) : (
              <>
                <h2
                  className="text-2xl font-extrabold tracking-tight text-[#f4f4f5]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Dia de Descanso
                </h2>
                <p className="text-sm text-[#9ca3af] mt-1">
                  Recuperação muscular programada. Se quiser treinar hoje, escolha uma ficha:
                </p>
              </>
            )}
          </div>

          <div className="mt-5">
            {todayWorkout ? (
              <button
                type="button"
                disabled={Boolean(activeSession)}
                onClick={() => onStartWorkout(todayWorkout.id)}
                className="w-full min-h-[46px] bg-[#a3e635] hover:bg-[#bef264] disabled:opacity-45 text-[#09090b] font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                {activeSession ? 'Há um treino em andamento' : 'Iniciar treino do dia'}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sortedWorkouts.map((wk) => (
                  <button
                    key={wk.id}
                    type="button"
                    disabled={Boolean(activeSession)}
                    onClick={() => onStartWorkout(wk.id)}
                    className="min-h-[44px] px-4 bg-[#18181c] hover:bg-[#222228] disabled:opacity-45 border border-[#27272e] text-[#f4f4f5] text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {wk.code.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Métricas semanais */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-xs text-[#9ca3af] font-semibold">Treinos na semana</p>
            <p className="text-2xl font-bold text-[#f4f4f5] font-mono tabular-nums mt-2">
              {weekCompleted.length} / {sortedWorkouts.length || 4}
            </p>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-xs text-[#a3e635] truncate">{activeDaysLabel}</p>
              <button
                type="button"
                onClick={onOpenScheduleConfig}
                className="text-[11px] font-bold text-[#9ca3af] hover:text-[#f4f4f5] underline shrink-0 cursor-pointer"
              >
                Descanso
              </button>
            </div>
          </div>

          <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-xs text-[#9ca3af] font-semibold">Volume semanal</p>
            <p className="text-2xl font-bold text-[#a3e635] font-mono tabular-nums mt-2">
              {Math.round(weekVolume).toLocaleString('pt-BR')} kg
            </p>
            <p className="text-xs text-[#9ca3af] mt-1">{weekCompleted.length} sessões</p>
          </div>

          <div className="col-span-2 bg-[#121215] border border-[#27272e] rounded-2xl p-4">
            <p className="text-xs text-[#9ca3af] font-semibold mb-1">Evolução recente</p>
            <p className="text-sm font-semibold text-[#f4f4f5]">{evolutionText}</p>
          </div>
        </div>
      </div>

      {/* Último treino */}
      <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4">
        <p className="text-xs text-[#9ca3af] font-semibold mb-2">Último treino</p>
        {lastSession ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-sm text-[#f4f4f5] truncate">{lastSession.workout_name}</p>
              <p className="text-xs text-[#9ca3af] font-mono tabular-nums mt-0.5">
                {formatDate(lastSession.started_at)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-bold text-[#a3e635] font-mono tabular-nums">
                {Math.round(Number(lastSession.total_volume_kg || 0)).toLocaleString('pt-BR')} kg
              </span>
              <button
                type="button"
                onClick={() => onOpenSessionDetail(lastSession.id)}
                className="min-h-[40px] px-3 text-xs font-semibold text-[#f4f4f5] bg-[#18181c] hover:bg-[#222228] border border-[#27272e] rounded-xl cursor-pointer whitespace-nowrap"
              >
                Ver detalhes
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#9ca3af]">Nenhum treino concluído ainda.</p>
        )}
      </div>
    </div>
  );
}
