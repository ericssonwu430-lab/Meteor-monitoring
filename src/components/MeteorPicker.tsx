"use client";

import type { RiskEvent } from "@/types/neo";
import InfoTip, { LabelWithInfo } from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";
import { LABELS } from "@/lib/labels";
import { formatImpactPercent } from "@/lib/format";

type Props = {
  risks: RiskEvent[];
  selectedIds: Set<string>;
  primaryId?: string | null;
  newIds?: Set<string>;
  onToggle: (id: string) => void;
  onPrimary?: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  className?: string;
};

function riskId(r: RiskEvent): string {
  return r.id || r.des;
}

function displayName(r: RiskEvent): string {
  const full = (r.fullname || "").trim();
  if (full && full !== r.des) return full;
  return r.des || r.id || "Unknown";
}

export default function MeteorPicker({
  risks,
  selectedIds,
  primaryId,
  newIds,
  onToggle,
  onPrimary,
  onSelectAll,
  onClear,
  className,
}: Props) {
  const selectedCount = selectedIds.size;

  return (
    <aside
      className={`flex min-h-0 flex-col rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-xl shadow-cyan-950/20 ${className ?? ""}`}
    >
      <div className="shrink-0 border-b border-slate-800 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <LabelWithInfo
              tip={TIPS.meteorsList}
              className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90"
            >
              Meteors
            </LabelWithInfo>
            <p className="text-xs text-slate-400">
              {selectedCount} of {risks.length} selected · newest discovery first
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onSelectAll}
              className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs font-medium text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs font-medium text-slate-300 hover:border-amber-600 hover:text-amber-300"
            >
              Clear
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
          Check trails on the globe. Tap a name to focus origin details.{" "}
          <span className="text-lime-400/90">{LABELS.newBadge}</span> marks
          objects that appeared after a refresh (kept ~24h on this device).
        </p>
      </div>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-1.5 py-2">
        {risks.length === 0 && (
          <li className="px-2 py-6 text-center text-xs text-slate-500">
            No Sentry risks to list.
          </li>
        )}
        {risks.map((r) => {
          const id = riskId(r);
          const checked = selectedIds.has(id);
          const focused = primaryId === id;
          const isNew = newIds?.has(id) ?? false;
          const ip = parseFloat(r.ip) || 0;
          const name = displayName(r);
          return (
            <li key={id}>
              <div
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                  focused
                    ? "bg-cyan-950/70 ring-1 ring-cyan-500/60"
                    : checked
                      ? "bg-cyan-950/40 ring-1 ring-cyan-700/30"
                      : "hover:bg-slate-900/80"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(id)}
                  aria-label={`Show ${name} on globe`}
                  className="h-5 w-5 shrink-0 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40"
                />
                <button
                  type="button"
                  onClick={() => onPrimary?.(id)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-slate-100">
                        {name}
                      </span>
                      {isNew && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-lime-500/20 px-1 py-0.5 text-[9px] font-bold tracking-wide text-lime-300 ring-1 ring-lime-400/40">
                          {LABELS.newBadge}
                          <InfoTip text={TIPS.newBadge} label={`About ${LABELS.newBadge}`} />
                        </span>
                      )}
                    </span>
                    {name !== r.des && (
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">
                        {r.des}
                      </span>
                    )}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
                      ip >= 0.01
                        ? "bg-red-950/80 text-red-300"
                        : ip >= 0.001
                          ? "bg-orange-950/80 text-orange-300"
                          : ip >= 0.0001
                            ? "bg-amber-950/80 text-amber-300"
                            : "bg-slate-800 text-cyan-300/90"
                    }`}
                  >
                    {formatImpactPercent(ip)}
                    <InfoTip
                      text={TIPS.impactProbability}
                      label="About impact probability"
                    />
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
