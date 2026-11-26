import type { ProgressionInsight, SetLog, WorkoutSession } from '../types.ts';

export function getIsoDayOfWeek(date = new Date()): number {
  const d = date.getDay();
  return d === 0 ? 7 : d; // 1=Mon .. 7=Sun
}

export function getDayNamePt(isoDay: number): string {
  switch (isoDay) {
    case 1:
      return 'Segunda-feira';
    case 2:
      return 'Terça-feira';
    case 3:
      return 'Quarta-feira';
    case 4:
      return 'Quinta-feira';
    case 5:
      return 'Sexta-feira';
    case 6:
      return 'Sábado';
    default:
      return 'Domingo';
  }
}

export function getDayShortPt(isoDay: number): string {
  switch (isoDay) {
    case 1:
      return 'Seg';
    case 2:
      return 'Ter';
    case 3:
      return 'Qua';
    case 4:
      return 'Qui';
    case 5:
      return 'Sex';
    case 6:
      return 'Sáb';
    default:
      return 'Dom';
  }
}

export function startOfWeekMs(nowMs = Date.now()): number {
  const date = new Date(nowMs);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const r = String(s % 60).padStart(2, '0');
  return `${m}:${r}`;
}

export function formatKg(val: number): string {
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}

export function computeProgression(
  exerciseKey: string,
  targetSets: number,
  repMax: number,
  sessions: WorkoutSession[],
  setLogs: SetLog[]
): ProgressionInsight {
  const completedSessionIds = new Set(
    sessions.filter((s) => s.status === 'completed').map((s) => s.id)
  );
  const matchingLogs = setLogs.filter(
    (l) =>
      l.exercise_key === exerciseKey &&
      l.completed === 1 &&
      completedSessionIds.has(l.session_id)
  );
  if (matchingLogs.length === 0) {
    return { hasHistory: false, lastWeightKg: 0, summary: '', shouldIncrease: false };
  }

  const lastSession = sessions.find(
    (s) => s.status === 'completed' && matchingLogs.some((l) => l.session_id === s.id)
  );
  if (!lastSession) {
    return { hasHistory: false, lastWeightKg: 0, summary: '', shouldIncrease: false };
  }

  const lastSets = matchingLogs
    .filter((l) => l.session_id === lastSession.id)
    .sort((a, b) => a.set_number - b.set_number);

  const summary = lastSets
    .map(
      (s) =>
        `${formatKg(Number(s.weight_kg || 0))}kg×${s.reps ?? 0}${
          s.rir !== null ? ` (RIR ${s.rir})` : ''
        }`
    )
    .join(' · ');

  const lastWeightKg = lastSets.reduce(
    (max, s) => Math.max(max, Number(s.weight_kg || 0)),
    0
  );

  const shouldIncrease =
    lastSets.length >= targetSets &&
    lastSets.every(
      (s) => Number(s.reps || 0) >= repMax && s.rir !== null && Number(s.rir) <= 3
    );

  return {
    hasHistory: true,
    lastWeightKg,
    summary,
    shouldIncrease,
  };
}

let audioCtx: AudioContext | null = null;

export function unlockRestAudio() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch {
    // Ignore unsupported audio contexts
  }
}

export function playRestCompleteAlert() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([250, 120, 250, 120, 400]);
    }
  } catch {
    // Ignore vibration errors
  }

  try {
    if (!audioCtx) unlockRestAudio();
    if (audioCtx) {
      [0, 0.25, 0.5].forEach((delaySec) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + delaySec);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime + delaySec);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delaySec + 0.18);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + delaySec);
        osc.stop(audioCtx.currentTime + delaySec + 0.19);
      });
    }
  } catch {
    // Ignore audio errors
  }

  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('IRON LOG – Descanso finalizado', {
        body: 'Hora da próxima série.',
      });
    }
  } catch {
    // Ignore notification errors
  }
}
