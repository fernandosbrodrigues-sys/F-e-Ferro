import { formatKg } from '../utils/training.ts';

export interface ChartPoint {
  label: string;
  value: number;
}

export function ProgressionLineChart({
  points,
  unit = 'kg',
  emptyText = 'Registre pelo menos 2 sessões para visualizar o gráfico.',
}: {
  points: ChartPoint[];
  unit?: string;
  emptyText?: string;
}) {
  if (points.length < 2) {
    return <p className="py-3 text-sm text-[#9ca3af]">{emptyText}</p>;
  }

  const w = 380;
  const h = 140;
  const padX = 28;
  const padTop = 22;
  const padBottom = 22;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((p, idx) => {
    const x = padX + (idx / (points.length - 1)) * (w - padX * 2);
    const y = h - padBottom - ((p.value - min) / span) * (h - padTop - padBottom);
    return { x, y, ...p };
  });

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36 overflow-visible">
      <line
        x1={padX}
        y1={h - padBottom}
        x2={w - padX}
        y2={h - padBottom}
        stroke="#27272e"
        strokeWidth="1"
      />
      <polyline
        fill="none"
        stroke="#a3e635"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      {coords.map((c, idx) => (
        <g key={`${c.label}-${idx}`}>
          <circle cx={c.x} cy={c.y} r="4" fill="#a3e635" />
          <text
            x={c.x}
            y={c.y - 9}
            fill="#f4f4f5"
            fontSize="10"
            fontWeight="700"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
          >
            {formatKg(c.value)}
            {unit}
          </text>
          <text
            x={c.x}
            y={h - 4}
            fill="#71717a"
            fontSize="9.5"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
          >
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function WeeklyVolumeBarChart({ bars }: { bars: ChartPoint[] }) {
  if (bars.length === 0) {
    return <p className="py-3 text-sm text-[#9ca3af]">Sem volume registrado ainda.</p>;
  }

  const w = 380;
  const h = 140;
  const padX = 8;
  const padTop = 20;
  const padBottom = 22;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const slotW = (w - padX * 2) / bars.length;
  const barW = slotW * 0.62;
  const chartH = h - padTop - padBottom;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36 overflow-visible">
      {bars.map((b, idx) => {
        const bh = Math.max(3, (b.value / max) * chartH);
        const x = padX + idx * slotW + (slotW - barW) / 2;
        const y = h - padBottom - bh;
        return (
          <g key={`${b.label}-${idx}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={bh}
              rx="4"
              fill={b.value > 0 ? '#a3e635' : '#222228'}
              fillOpacity={b.value > 0 ? 0.9 : 1}
            />
            {b.value > 0 && (
              <text
                x={x + barW / 2}
                y={y - 5}
                fill="#f4f4f5"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="middle"
              >
                {Math.round(b.value)}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={h - 4}
              fill="#71717a"
              fontSize="9.5"
              fontFamily="JetBrains Mono, monospace"
              textAnchor="middle"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
