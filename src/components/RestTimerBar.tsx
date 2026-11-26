import type { RestTimerState } from '../types.ts';
import { formatClock } from '../utils/training.ts';

interface RestTimerBarProps {
  timer: RestTimerState;
  remainingSec: number;
  onTogglePause: () => void;
  onRestart: () => void;
  onSkip: () => void;
  onAdjust: (deltaSec: number) => void;
}

export function RestTimerBar({
  timer,
  remainingSec,
  onTogglePause,
  onRestart,
  onSkip,
  onAdjust,
}: RestTimerBarProps) {
  const pct = Math.min(100, Math.max(0, (remainingSec / Math.max(1, timer.plannedSec)) * 100));

  return (
    <div className="fixed bottom-[72px] lg:bottom-5 left-1/2 -translate-x-1/2 lg:left-auto lg:right-5 lg:translate-x-0 w-[calc(100%-24px)] max-w-md bg-[#141810]/95 backdrop-blur-md border border-[#a3e635] rounded-2xl p-3.5 z-40 shadow-2xl">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#a3e635] truncate">
            Descanso · {timer.exerciseName}
          </p>
          <p className="text-3xl font-bold text-[#a3e635] font-mono tabular-nums leading-none mt-1">
            {formatClock(remainingSec)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onTogglePause}
            className="min-h-[40px] px-3 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] text-xs font-bold text-[#f4f4f5] rounded-xl cursor-pointer whitespace-nowrap"
          >
            {timer.isPaused ? 'Continuar' : 'Pausar'}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="min-h-[40px] px-3 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] text-xs font-bold text-[#f4f4f5] rounded-xl cursor-pointer whitespace-nowrap"
          >
            Reiniciar
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[40px] px-3 bg-[#ef4444]/15 hover:bg-[#ef4444]/25 border border-[#ef4444]/40 text-xs font-bold text-[#fca5a5] rounded-xl cursor-pointer whitespace-nowrap"
          >
            Pular
          </button>
        </div>
      </div>

      <div className="h-1.5 bg-[#222228] rounded-full overflow-hidden my-2.5">
        <div
          className="h-full bg-[#a3e635] transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-[#9ca3af] font-mono tabular-nums">Alvo: {timer.plannedSec}s</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAdjust(-15)}
            className="px-2.5 py-1 text-xs font-bold text-[#9ca3af] hover:text-[#f4f4f5] cursor-pointer"
          >
            -15s
          </button>
          <button
            type="button"
            onClick={() => onAdjust(15)}
            className="px-2.5 py-1 text-xs font-bold text-[#a3e635] hover:text-[#bef264] cursor-pointer"
          >
            +15s
          </button>
        </div>
      </div>
    </div>
  );
}
