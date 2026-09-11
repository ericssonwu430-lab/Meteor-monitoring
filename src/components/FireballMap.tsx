"use client";

import type { Fireball } from "@/types/neo";

type Props = {
  fireballs: Fireball[];
};

/** Simple equirectangular SVG world map with fireball dots — no Mapbox. */
export default function FireballMap({ fireballs }: Props) {
  const w = 720;
  const h = 360;

  const project = (lat: number, lon: number) => {
    const x = ((lon + 180) / 360) * w;
    const y = ((90 - lat) / 180) * h;
    return { x, y };
  };

  const points = fireballs.filter(
    (f) => f.lat != null && f.lon != null && Number.isFinite(f.lat) && Number.isFinite(f.lon)
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      <div className="border-b border-slate-800 px-3 py-2 text-xs uppercase tracking-wider text-slate-400">
        Recent fireballs (lat/lon)
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full"
        role="img"
        aria-label="World map of recent fireball events"
      >
        <rect width={w} height={h} fill="#0b1220" />
        {/* simple graticule */}
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={(i * w) / 12}
            y1={0}
            x2={(i * w) / 12}
            y2={h}
            stroke="#1e293b"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={(i * h) / 6}
            x2={w}
            y2={(i * h) / 6}
            stroke="#1e293b"
            strokeWidth={1}
          />
        ))}
        {/* crude continents silhouette via equator/tropics labels */}
        <text x={8} y={18} fill="#475569" fontSize={10}>
          90°N
        </text>
        <text x={8} y={h / 2 + 4} fill="#475569" fontSize={10}>
          0°
        </text>
        <text x={8} y={h - 8} fill="#475569" fontSize={10}>
          90°S
        </text>
        {points.map((f, i) => {
          const { x, y } = project(f.lat!, f.lon!);
          const energy = f.energy ? parseFloat(f.energy) : 1;
          const r = Math.min(10, Math.max(3, Math.log10(energy + 1) * 3 + 2));
          return (
            <g key={`${f.date}-${i}`}>
              <circle cx={x} cy={y} r={r} fill="#f59e0b" fillOpacity={0.85}>
                <title>
                  {f.date}
                  {f.energy ? ` · ${f.energy} kt` : ""}
                  {f.impact_e ? ` · ${f.impact_e} kt impact` : ""}
                </title>
              </circle>
              <circle
                cx={x}
                cy={y}
                r={r + 4}
                fill="none"
                stroke="#fbbf24"
                strokeOpacity={0.35}
              />
            </g>
          );
        })}
      </svg>
      <p className="px-3 py-2 text-[11px] text-slate-500">
        {points.length} events plotted · energy (kt) scales marker size
      </p>
    </div>
  );
}
