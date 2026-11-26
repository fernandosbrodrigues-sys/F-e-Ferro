import { useState } from 'react';
import type { Workout } from '../types.ts';
import { getDayNamePt } from '../utils/training.ts';

interface RestScheduleModalProps {
  workouts: Workout[];
  onClose: () => void;
  onSave: (assignments: Array<{ workoutId: string; dayOfWeek: number }>) => Promise<void>;
}

const DEFAULT_DAYS_BY_CODE: Record<string, number> = {
  UPPER_A: 1,
  LOWER_A: 2,
  UPPER_B: 4,
  LOWER_B: 5,
};

function buildSlotsFromWorkouts(workouts: Workout[]): Record<number, Workout | null> {
  const slots: Record<number, Workout | null> = {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
  };
  for (const wk of workouts) {
    if (wk.day_of_week >= 1 && wk.day_of_week <= 7) {
      slots[wk.day_of_week] = wk;
    }
  }
  return slots;
}

export function RestScheduleModal({ workouts, onClose, onSave }: RestScheduleModalProps) {
  const [slots, setSlots] = useState<Record<number, Workout | null>>(() =>
    buildSlotsFromWorkouts(workouts)
  );
  const [saving, setSaving] = useState(false);

  const setDayAsRest = (day: number) => {
    setSlots((prev) => {
      if (!prev[day]) return prev;
      const next = { ...prev };
      let moving: Workout | null = next[day];
      next[day] = null;

      let cur = (day % 7) + 1;
      for (let i = 0; i < 7 && moving; i++) {
        const displaced = next[cur];
        next[cur] = moving;
        moving = displaced;
        cur = (cur % 7) + 1;
      }
      return next;
    });
  };

  const setDayAsTraining = (day: number) => {
    setSlots((prev) => {
      if (prev[day]) return prev;
      const next = { ...prev };

      // Find nearest next workout day clockwise
      let firstWkDay: number | null = null;
      let cur = (day % 7) + 1;
      for (let i = 0; i < 7; i++) {
        if (next[cur]) {
          firstWkDay = cur;
          break;
        }
        cur = (cur % 7) + 1;
      }
      if (firstWkDay === null) return prev;

      // Move that workout into `day` and pull contiguous block back 1 step
      let writeDay = day;
      let readDay = firstWkDay;
      for (let i = 0; i < 7; i++) {
        const wk = next[readDay];
        if (!wk) break;
        next[writeDay] = wk;
        next[readDay] = null;
        writeDay = readDay;
        readDay = (readDay % 7) + 1;
        if (!next[readDay]) break;
      }
      return next;
    });
  };

  const shiftAllByOneDay = (delta: 1 | -1) => {
    setSlots((prev) => {
      const next: Record<number, Workout | null> = {
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
      };
      for (let d = 1; d <= 7; d++) {
        const target = delta === 1 ? (d % 7) + 1 : ((d - 2 + 7) % 7) + 1;
        next[target] = prev[d];
      }
      return next;
    });
  };

  const resetDefault = () => {
    const next: Record<number, Workout | null> = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
      7: null,
    };
    for (const wk of workouts) {
      const defDay = DEFAULT_DAYS_BY_CODE[wk.code] || wk.day_of_week;
      next[defDay] = wk;
    }
    setSlots(next);
  };

  const handleSave = async () => {
    const assignments: Array<{ workoutId: string; dayOfWeek: number }> = [];
    for (let d = 1; d <= 7; d++) {
      const wk = slots[d];
      if (wk) {
        assignments.push({ workoutId: wk.id, dayOfWeek: d });
      }
    }
    if (assignments.length !== workouts.length) return;
    setSaving(true);
    try {
      await onSave(assignments);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#121215] border border-[#27272e] rounded-2xl p-4 max-h-[88dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3
            className="text-base font-extrabold tracking-tight text-[#f4f4f5]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Dias de Descanso e Treino
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-[#9ca3af] hover:text-[#f4f4f5] px-2 py-1 cursor-pointer"
          >
            Fechar
          </button>
        </div>
        <p className="text-xs text-[#9ca3af] mb-3">
          Escolha o dia de descanso: ao descansar em um dia de treino, ele passa para o próximo dia automaticamente.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <button
            type="button"
            onClick={() => shiftAllByOneDay(-1)}
            className="min-h-[38px] px-2 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] rounded-xl text-xs font-bold text-[#f4f4f5] cursor-pointer"
          >
            ← Voltar 1 dia
          </button>
          <button
            type="button"
            onClick={() => shiftAllByOneDay(1)}
            className="min-h-[38px] px-2 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] rounded-xl text-xs font-bold text-[#a3e635] cursor-pointer"
          >
            Empurrar +1 dia
          </button>
          <button
            type="button"
            onClick={resetDefault}
            className="min-h-[38px] px-2 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] rounded-xl text-xs font-semibold text-[#9ca3af] cursor-pointer"
          >
            Padrão
          </button>
        </div>

        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const wk = slots[day];
            const isRest = !wk;
            return (
              <div
                key={day}
                className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3 ${
                  isRest
                    ? 'bg-[#09090b] border-[#27272e]'
                    : 'bg-[#18181c] border-[#a3e635]/35'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#f4f4f5]">{getDayNamePt(day)}</p>
                  {wk ? (
                    <p className="text-xs font-semibold text-[#a3e635] truncate mt-0.5">
                      {wk.code.replace('_', ' ')} · <span className="text-[#9ca3af] font-normal">{wk.subtitle}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-[#9ca3af] mt-0.5">Descanso</p>
                  )}
                </div>

                {wk ? (
                  <button
                    type="button"
                    onClick={() => setDayAsRest(day)}
                    className="min-h-[36px] px-3 bg-[#121215] hover:bg-[#222228] border border-[#27272e] text-xs font-bold text-[#f4f4f5] rounded-lg shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    Descansar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDayAsTraining(day)}
                    className="min-h-[36px] px-3 bg-[#a3e635]/15 hover:bg-[#a3e635]/25 border border-[#a3e635]/40 text-xs font-bold text-[#a3e635] rounded-lg shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    Treinar aqui
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#27272e]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 bg-[#18181c] border border-[#27272e] text-xs font-bold text-[#9ca3af] rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="min-h-[42px] px-5 bg-[#a3e635] hover:bg-[#bef264] disabled:opacity-50 text-[#09090b] text-xs font-bold rounded-xl cursor-pointer"
          >
            {saving ? 'Salvando...' : 'Salvar escala'}
          </button>
        </div>
      </div>
    </div>
  );
}
