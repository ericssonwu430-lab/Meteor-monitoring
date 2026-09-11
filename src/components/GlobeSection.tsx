"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Fireball, RiskEvent } from "@/types/neo";
import MeteorPicker from "@/components/MeteorPicker";

const EarthGlobe = dynamic(() => import("@/components/EarthGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(62vh,560px)] min-h-[360px] flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-950">
      <p className="text-sm text-slate-500">Loading 3D globe…</p>
    </div>
  ),
});

const DEFAULT_SELECT = 3;

function riskId(r: RiskEvent): string {
  return r.id || r.des;
}

type Props = {
  risks: RiskEvent[];
  fireballs: Fireball[];
};

export default function GlobeSection({ risks, fireballs }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [listOpen, setListOpen] = useState(true);

  const idsKey = useMemo(
    () => risks.map(riskId).join("|"),
    [risks]
  );

  // Default: top 1–3 by impact % (risks already sorted by caller)
  useEffect(() => {
    if (risks.length === 0) {
      setSelectedIds(new Set());
      setInitialized(true);
      return;
    }
    if (!initialized) {
      const top = risks.slice(0, Math.min(DEFAULT_SELECT, risks.length));
      setSelectedIds(new Set(top.map(riskId)));
      setInitialized(true);
      return;
    }
    // Drop selections for risks that left the list; keep user choices otherwise
    setSelectedIds((prev) => {
      const valid = new Set(risks.map(riskId));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      if (next.size === 0 && risks.length > 0) {
        risks.slice(0, Math.min(DEFAULT_SELECT, risks.length)).forEach((r) => {
          next.add(riskId(r));
        });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync when risk id set changes
  }, [idsKey]);

  const onToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSelectAll = useCallback(() => {
    setSelectedIds(new Set(risks.map(riskId)));
  }, [risks]);

  const onClear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedList = useMemo(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 md:hidden">
        <p className="text-xs text-slate-400">
          {selectedIds.size} meteor{selectedIds.size === 1 ? "" : "s"} on globe
        </p>
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
        >
          {listOpen ? "Hide list" : "Show meteor list"}
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div
          className={`${
            listOpen ? "block" : "hidden"
          } md:block lg:w-[280px] lg:shrink-0 xl:w-[300px]`}
        >
          <MeteorPicker
            risks={risks}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onSelectAll={onSelectAll}
            onClear={onClear}
            className="h-[220px] sm:h-[260px] lg:h-full lg:min-h-[420px] lg:max-h-[560px]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <EarthGlobe
            risks={risks}
            fireballs={fireballs}
            selectedIds={selectedList}
          />
        </div>
      </div>
    </div>
  );
}
