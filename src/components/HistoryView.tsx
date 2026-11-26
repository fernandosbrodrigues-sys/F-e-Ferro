import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.ts';
import type {
  ActiveSessionPayload,
  AlternativeOption,
  SetLog,
  SetLogPatch,
  WorkoutSession,
} from '../types.ts';
import {
  formatDate,
  formatKg,
  formatShortDate,
  startOfWeekMs,
} from '../utils/training.ts';
import { ProgressionLineChart, WeeklyVolumeBarChart } from './Charts.tsx';
import { SetCard } from './WorkoutsView.tsx';

interface HistoryViewProps {
  sessions: WorkoutSession[];
  setLogs: SetLog[];
  selectedSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onUpdateSet: (setId: string, patch: SetLogPatch) => Promise<void>;
  onToggleSetDone: (setLog: SetLog) => Promise<void>;
  onSubstituteHistoricalExercise: (
    sessionExerciseId: string,
    option: AlternativeOption
  ) => Promise<void>;
}

export function HistoryView({
  sessions,
  setLogs,
  selectedSessionId,
  onSelectSession,
  onUpdateSet,
  onToggleSetDone,
  onSubstituteHistoricalExercise,
}: HistoryViewProps) {
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions]
  );
  const completedIds = useMemo(
    () => new Set(completedSessions.map((s) => s.id)),
    [completedSessions]
  );

  // 6-week volume bars
  const weekBars = useMemo(() => {
    const curWeekStart = startOfWeekMs();
    const weekMs = 7 * 24 * 3600 * 1000;
    return [5, 4, 3, 2, 1, 0].map((i) => {
      const ws = curWeekStart - i * weekMs;
      const we = ws + weekMs;
      const vol = completedSessions
        .filter((s) => s.started_at >= ws && s.started_at < we)
        .reduce((acc, s) => acc + Number(s.total_volume_kg || 0), 0);
      return { label: formatShortDate(ws), value: vol };
    });
  }, [completedSessions]);

  // Unique variations with separate history
  const variations = useMemo(() => {
    const map = new Map<string, string>();
    setLogs
      .filter((l) => l.completed === 1 && completedIds.has(l.session_id))
      .forEach((l) => {
        if (!map.has(l.exercise_key)) {
          map.set(l.exercise_key, l.exercise_name);
        }
      });
    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [setLogs, completedIds]);

  const [selectedKey, setSelectedKey] = useState<string>('');
  useEffect(() => {
    if (variations.length > 0 && !variations.some((v) => v.key === selectedKey)) {
      setSelectedKey(variations[0].key);
    }
  }, [variations, selectedKey]);

  const { prMaxWeight, prEst1Rm, prMaxSetVol, chartPoints } = useMemo(() => {
    if (!selectedKey) {
      return { prMaxWeight: 0, prEst1Rm: 0, prMaxSetVol: 0, chartPoints: [] };
    }
    const logs = setLogs.filter(
      (l) =>
        l.exercise_key === selectedKey &&
        l.completed === 1 &&
        completedIds.has(l.session_id)
    );
    let maxW = 0;
    let est1Rm = 0;
    let maxSetVol = 0;
    for (const l of logs) {
      const w = Number(l.weight_kg || 0);
      const r = Number(l.reps || 0);
      if (w > maxW) maxW = w;
      if (w * r > maxSetVol) maxSetVol = w * r;
      const e1 = r > 0 ? w * (1 + r / 30) : w;
      if (e1 > est1Rm) est1Rm = e1;
    }

    const points = completedSessions
      .slice()
      .reverse()
      .map((s) => {
        const sLogs = logs.filter((l) => l.session_id === s.id);
        if (sLogs.length === 0) return null;
        const topW = Math.max(...sLogs.map((l) => Number(l.weight_kg || 0)));
        return { label: formatShortDate(s.started_at), value: topW };
      })
      .filter((p): p is { label: string; value: number } => p !== null)
      .slice(-8);

    return { prMaxWeight: maxW, prEst1Rm: est1Rm, prMaxSetVol: maxSetVol, chartPoints: points };
  }, [selectedKey, setLogs, completedIds, completedSessions]);

  const [detail, setDetail] = useState<ActiveSessionPayload | null>(null);
  const [editingVarFor, setEditingVarFor] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSessionId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    api
      .getSessionDetail(selectedSessionId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, setLogs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4">
          <h2 className="text-sm font-bold text-[#f4f4f5] mb-2">Volume Semanal (kg)</h2>
          <WeeklyVolumeBarChart bars={weekBars} />
        </div>

        <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4">
          <h2 className="text-sm font-bold text-[#f4f4f5] mb-2">
            Evolução e Recordes por Exercício
          </h2>
          {variations.length === 0 ? (
            <p className="text-sm text-[#9ca3af] py-3">
              Conclua treinos para visualizar gráficos de progressão e recordes pessoais.
            </p>
          ) : (
            <>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full min-h-[42px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3 py-2 text-sm font-semibold text-[#f4f4f5] outline-none mb-3"
              >
                {variations.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-3 gap-2 mb-2 text-center bg-[#18181c] border border-[#27272e] rounded-xl p-2.5">
                <div>
                  <p className="text-[11px] text-[#9ca3af]">PR Carga</p>
                  <p className="text-sm font-bold text-[#a3e635] font-mono tabular-nums">
                    {formatKg(prMaxWeight)} kg
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#9ca3af]">1RM Est.</p>
                  <p className="text-sm font-bold text-[#f4f4f5] font-mono tabular-nums">
                    {Math.round(prEst1Rm)} kg
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#9ca3af]">Vol. Série</p>
                  <p className="text-sm font-bold text-[#f4f4f5] font-mono tabular-nums">
                    {Math.round(prMaxSetVol)} kg
                  </p>
                </div>
              </div>

              <ProgressionLineChart points={chartPoints} unit="kg" />
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-[#f4f4f5] mb-2">
          Histórico de Treinos ({completedSessions.length})
        </h3>
        {completedSessions.length === 0 ? (
          <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4">
            <p className="text-sm text-[#9ca3af]">Nenhum treino registrado até o momento.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {completedSessions.map((sess) => (
              <button
                key={sess.id}
                type="button"
                onClick={() => onSelectSession(sess.id)}
                className="w-full text-left bg-[#121215] hover:bg-[#18181c] border border-[#27272e] rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#f4f4f5] truncate">{sess.workout_name}</p>
                  <p className="text-xs text-[#9ca3af] font-mono tabular-nums mt-0.5">
                    {formatDate(sess.started_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#a3e635] font-mono tabular-nums">
                    {Math.round(Number(sess.total_volume_kg || 0)).toLocaleString('pt-BR')} kg
                  </p>
                  <p className="text-[11px] text-[#9ca3af]">Tocar p/ editar</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalhes e edição */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-3"
          onClick={() => onSelectSession(null)}
        >
          <div
            className="w-full max-w-lg bg-[#121215] border border-[#27272e] rounded-2xl p-4 max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#27272e]">
              <div>
                <h3 className="text-base font-bold text-[#f4f4f5]">
                  {detail.session.workout_name}
                </h3>
                <p className="text-xs text-[#9ca3af] font-mono tabular-nums mt-0.5">
                  {formatDate(detail.session.started_at)} · Volume:{' '}
                  {Math.round(Number(detail.session.total_volume_kg || 0)).toLocaleString('pt-BR')} kg
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectSession(null)}
                className="text-xs font-bold text-[#a3e635] px-2.5 py-1.5 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-4 mt-3">
              {detail.items.map((item) => {
                const se = item.exercise;
                const isSub = se.performed_exercise_key !== se.original_exercise_key;
                const options: AlternativeOption[] = [
                  {
                    key: se.original_exercise_key,
                    name: se.original_exercise_name,
                    default_rest_sec: se.default_rest_sec,
                  },
                  ...se.alternatives.filter((a) => a.key !== se.original_exercise_key),
                ];

                return (
                  <div key={se.id} className="pb-3 border-b border-[#27272e]/70 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#f4f4f5]">
                          {se.performed_exercise_name}
                        </p>
                        {isSub && (
                          <p className="text-xs text-[#a3e635]">
                            Substituiu: {se.original_exercise_name}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingVarFor(editingVarFor === se.id ? null : se.id)
                        }
                        className="text-xs font-bold text-[#a3e635] px-2 py-1 cursor-pointer shrink-0"
                      >
                        Trocar variação
                      </button>
                    </div>

                    {editingVarFor === se.id && (
                      <div className="mt-2 space-y-1.5">
                        {options.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={async () => {
                              await onSubstituteHistoricalExercise(se.id, opt);
                              setEditingVarFor(null);
                              const refreshed = await api.getSessionDetail(detail.session.id);
                              setDetail(refreshed);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                              opt.key === se.performed_exercise_key
                                ? 'bg-[#a3e635]/10 border-[#a3e635] text-[#a3e635]'
                                : 'bg-[#18181c] border-[#27272e] text-[#f4f4f5]'
                            }`}
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 space-y-2">
                      {item.sets.map((s) => (
                        <SetCard
                          key={s.id}
                          setLog={s}
                          repPlaceholder={`${se.rep_min}-${se.rep_max}`}
                          weightPlaceholder="0"
                          canDelete={false}
                          onUpdate={onUpdateSet}
                          onToggleDone={() => onToggleSetDone(s)}
                          onDelete={async () => {}}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
