"use client";

import { useMemo, useState } from "react";
import type { RiskEvent } from "@/types/neo";
import InfoTip from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";
import { LABELS } from "@/lib/labels";
import { discoveryYear } from "@/lib/discovery";
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
  /** Optional: select only the currently filtered/search-visible ids */
  onSelectIds?: (ids: string[]) => void;
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

function yearKey(r: RiskEvent): string {
  const y = discoveryYear(r);
  return y != null ? String(y) : "Unknown year";
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
  onSelectIds,
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const selectedCount = selectedIds.size;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return risks;
    return risks.filter((r) => {
      const name = displayName(r).toLowerCase();
      const des = (r.des || "").toLowerCase();
      const full = (r.fullname || "").toLowerCase();
      const year = yearKey(r).toLowerCase();
      return (
        name.includes(q) ||
        des.includes(q) ||
        full.includes(q) ||
        year.includes(q)
      );
    });
  }, [risks, query]);

  const groups = useMemo(() => {
    const map = new Map<string, RiskEvent[]>();
    for (const r of filtered) {
      const key = yearKey(r);
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "Unknown year") return 1;
      if (b === "Unknown year") return -1;
      return parseInt(b, 10) - parseInt(a, 10);
    });
    return keys.map((year) => ({ year, items: map.get(year)! }));
  }, [filtered]);

  const visibleIds = useMemo(() => filtered.map(riskId), [filtered]);

  return (
    <aside
      className={`flex flex-col rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-xl shadow-cyan-950/20 ${className ?? ""}`}
    >
      <div className="shrink-0 border-b border-slate-800 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90">
              Meteors
            </p>
            <p className="text-xs text-slate-400">
              {selectedCount} selected · {filtered.length} shown
              {query.trim() ? ` (of ${risks.length})` : ""} · by year
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (onSelectIds && query.trim()) onSelectIds(visibleIds);
                else onSelectAll();
              }}
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

        <label className="mt-2 block">
          <span className="sr-only">Search meteors</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search name, ID, or year…"
            className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
      </div>

      <div className="space-y-3 px-1.5 py-2">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-slate-500">
            {query.trim()
              ? "No meteors match that search."
              : "No Sentry risks to list."}
          </p>
        )}
        {groups.map(({ year, items }) => (
          <section key={year} className="space-y-0.5">
            <h3 className="sticky top-0 z-[1] flex items-center justify-between gap-2 rounded-md bg-slate-950/95 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300/90 backdrop-blur">
              <span>{year}</span>
              <span className="font-mono text-[10px] font-normal text-slate-500">
                {items.length}
              </span>
            </h3>
            <ul className="space-y-0.5">
              {items.map((r) => {
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
          </section>
        ))}
      </div>
    </aside>
  );
}
