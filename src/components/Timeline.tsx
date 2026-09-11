"use client";

import type { CloseApproach, Fireball } from "@/types/neo";
import InfoTip, { LabelWithInfo } from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";
import { formatAu } from "@/lib/format";

type Props = {
  approaches: CloseApproach[];
  fireballs: Fireball[];
};

type Item =
  | { kind: "cad"; date: string; label: string; detail: string }
  | { kind: "fireball"; date: string; label: string; detail: string };

export default function Timeline({ approaches, fireballs }: Props) {
  const items: Item[] = [
    ...approaches.slice(0, 40).map((a) => ({
      kind: "cad" as const,
      date: a.cd,
      label: a.des,
      detail: `${formatAu(a.dist)} · v∞ ${parseFloat(a.v_inf).toFixed(1)} km/s`,
    })),
    ...fireballs.slice(0, 40).map((f) => ({
      kind: "fireball" as const,
      date: f.date,
      label: "Fireball",
      detail: [
        f.energy ? `${f.energy} kt` : null,
        f.lat != null && f.lon != null
          ? `${f.lat.toFixed(1)}°, ${f.lon.toFixed(1)}°`
          : null,
        f.alt ? `alt ${f.alt} km` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  ].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  // CAD dates like "2026-Sep-11 04:27" — Date.parse may fail; keep original order mix
  const sorted = [...items].sort((a, b) => {
    const ta = Date.parse(a.date.replace(/-/g, " "));
    const tb = Date.parse(b.date.replace(/-/g, " "));
    if (Number.isNaN(ta) || Number.isNaN(tb)) return a.date.localeCompare(b.date);
    return ta - tb;
  });

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60">
      <div className="flex items-center gap-1.5 border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-200">
        <LabelWithInfo tip={TIPS.eventsFeed} className="text-sm font-medium text-slate-200">
          Events
        </LabelWithInfo>
        <span className="text-slate-500">·</span>
        <span className="text-xs font-normal text-slate-400">
          close approaches (next 60d) &amp; recent fireballs
        </span>
      </div>
      <ul className="max-h-[420px] overflow-y-auto divide-y divide-slate-800">
        {sorted.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            No events
          </li>
        )}
        {sorted.map((item, i) => (
          <li
            key={`${item.kind}-${item.date}-${item.label}-${i}`}
            className="flex gap-3 px-4 py-2.5 text-sm"
          >
            <span
              className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                item.kind === "cad" ? "bg-cyan-400" : "bg-amber-400"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-slate-100">{item.label}</span>
                <span className="font-mono text-xs text-slate-500">
                  {item.date}
                </span>
              </div>
              <p className="truncate text-xs text-slate-400">{item.detail}</p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-0.5 self-center rounded px-1.5 py-0.5 text-[10px] uppercase ${
                item.kind === "cad"
                  ? "bg-cyan-950 text-cyan-300"
                  : "bg-amber-950 text-amber-300"
              }`}
            >
              {item.kind === "cad" ? "CAD" : "FB"}
              <InfoTip
                text={item.kind === "cad" ? TIPS.closeApproach : TIPS.fireballs}
                label={item.kind === "cad" ? "About CAD" : "About fireballs"}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
