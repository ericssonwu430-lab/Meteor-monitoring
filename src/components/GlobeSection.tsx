"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Fireball, OrbitElements, RiskEvent } from "@/types/neo";
import type { GlobeViewMode } from "@/components/EarthGlobe";
import MeteorPicker from "@/components/MeteorPicker";
import MeteorDetail from "@/components/MeteorDetail";
import TrajectoryTimeline from "@/components/TrajectoryTimeline";
import DataFreshness from "@/components/DataFreshness";

const EarthGlobe = dynamic(() => import("@/components/EarthGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(58vh,520px)] min-h-[300px] flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 sm:min-h-[360px]">
      <p className="text-sm text-slate-500">Loading 3D globe…</p>
    </div>
  ),
});

const DEFAULT_SELECT = 3;
const LOOP_SECONDS = 8;

function riskId(r: RiskEvent): string {
  return r.id || r.des;
}

type Props = {
  risks: RiskEvent[];
  fireballs: Fireball[];
  updatedAt?: Date | null;
};

export default function GlobeSection({ risks, fireballs, updatedAt }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [viewMode, setViewMode] = useState<GlobeViewMode>("earth");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [orbits, setOrbits] = useState<Record<string, OrbitElements>>({});
  const [orbitLoading, setOrbitLoading] = useState<Record<string, boolean>>({});
  const orbitCache = useRef<Record<string, OrbitElements>>({});
  const orbitInflight = useRef<Set<string>>(new Set());

  const idsKey = useMemo(
    () => risks.map(riskId).join("|"),
    [risks]
  );

  useEffect(() => {
    if (risks.length === 0) {
      setSelectedIds(new Set());
      setPrimaryId(null);
      setInitialized(true);
      return;
    }
    if (!initialized) {
      const top = risks.slice(0, Math.min(DEFAULT_SELECT, risks.length));
      setSelectedIds(new Set(top.map(riskId)));
      setPrimaryId(top[0] ? riskId(top[0]) : null);
      setInitialized(true);
      return;
    }
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
    setPrimaryId((prev) => {
      const valid = new Set(risks.map(riskId));
      if (prev && valid.has(prev)) return prev;
      return risks[0] ? riskId(risks[0]) : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync when risk id set changes
  }, [idsKey]);

  const onToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setPrimaryId(id);
      }
      return next;
    });
  }, []);

  const onPrimary = useCallback((id: string) => {
    setPrimaryId(id);
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const onSelectAll = useCallback(() => {
    setSelectedIds(new Set(risks.map(riskId)));
    setPrimaryId((prev) => prev ?? (risks[0] ? riskId(risks[0]) : null));
  }, [risks]);

  const onClear = useCallback(() => {
    setSelectedIds(new Set());
    setPrimaryId(null);
  }, []);

  const selectedList = useMemo(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  useEffect(() => {
    if (primaryId && selectedIds.has(primaryId)) return;
    const first = selectedList[0] ?? null;
    setPrimaryId(first);
  }, [primaryId, selectedIds, selectedList]);

  const primaryRisk = useMemo(() => {
    if (primaryId) {
      const hit = risks.find((r) => riskId(r) === primaryId);
      if (hit) return hit;
    }
    return null;
  }, [primaryId, risks]);

  useEffect(() => {
    const dess = Array.from(
      new Set(
        risks
          .filter((r) => selectedIds.has(riskId(r)))
          .map((r) => r.des)
          .filter(Boolean)
      )
    );
    dess.forEach((des) => {
      if (orbitCache.current[des]) {
        setOrbits((prev) =>
          prev[des] ? prev : { ...prev, [des]: orbitCache.current[des] }
        );
        return;
      }
      if (orbitInflight.current.has(des)) return;
      orbitInflight.current.add(des);
      setOrbitLoading((prev) => ({ ...prev, [des]: true }));
      (async () => {
        try {
          const res = await fetch(`/api/sbdb/${encodeURIComponent(des)}`);
          const json = await res.json();
          const orbit = (json.orbit ?? {
            a: null,
            e: null,
            i: null,
            om: null,
            w: null,
            ma: null,
            q: null,
            ad: null,
            orbitClass: null,
            orbitClassCode: null,
            designation: null,
            fullname: null,
            firstObs: null,
            lastObs: null,
            dataArc: null,
            moid: null,
            available: false,
            error: json.error || "SBDB unavailable",
          }) as OrbitElements;
          orbitCache.current[des] = orbit;
          setOrbits((prev) => ({ ...prev, [des]: orbit }));
        } catch {
          const failed: OrbitElements = {
            a: null,
            e: null,
            i: null,
            om: null,
            w: null,
            ma: null,
            q: null,
            ad: null,
            orbitClass: null,
            orbitClassCode: null,
            designation: null,
            fullname: null,
            firstObs: null,
            lastObs: null,
            dataArc: null,
            moid: null,
            available: false,
            error: "SBDB fetch failed",
          };
          orbitCache.current[des] = failed;
          setOrbits((prev) => ({ ...prev, [des]: failed }));
        } finally {
          orbitInflight.current.delete(des);
          setOrbitLoading((prev) => ({ ...prev, [des]: false }));
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch by selected designations
  }, [selectedList.join("|"), idsKey]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        setProgress((p) => (p + dt / LOOP_SECONDS) % 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const onViewMode = useCallback((mode: GlobeViewMode) => {
    setViewMode(mode);
    setProgress(0);
  }, []);

  const orbitsLoading = useMemo(() => {
    if (!primaryRisk) {
      return selectedList.some((id) => {
        const r = risks.find((x) => riskId(x) === id);
        return r ? orbitLoading[r.des] && !orbits[r.des] : false;
      });
    }
    return !!orbitLoading[primaryRisk.des] && !orbits[primaryRisk.des];
  }, [orbitLoading, orbits, primaryRisk, selectedList, risks]);

  const solarKeplerReady =
    viewMode !== "solar" ||
    selectedList.some((id) => {
      const r = risks.find((x) => riskId(x) === id);
      return r && orbits[r.des]?.available;
    });

  return (
    <div className="space-y-3">
      <DataFreshness updatedAt={updatedAt ?? null} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex rounded-xl border border-slate-700 bg-slate-950/80 p-0.5"
          role="group"
          aria-label="Globe view mode"
        >
          <button
            type="button"
            onClick={() => onViewMode("earth")}
            className={`min-h-11 min-w-[88px] rounded-lg px-3 text-sm font-medium ${
              viewMode === "earth"
                ? "bg-cyan-500 text-slate-950"
                : "text-slate-300 hover:text-cyan-200"
            }`}
          >
            Earth
          </button>
          <button
            type="button"
            onClick={() => onViewMode("solar")}
            className={`min-h-11 min-w-[88px] rounded-lg px-3 text-sm font-medium ${
              viewMode === "solar"
                ? "bg-cyan-500 text-slate-950"
                : "text-slate-300 hover:text-cyan-200"
            }`}
          >
            Solar system
          </button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <p className="text-xs text-slate-400">
            {selectedIds.size} meteor{selectedIds.size === 1 ? "" : "s"} on view
          </p>
          <button
            type="button"
            onClick={() => setListOpen((o) => !o)}
            className="min-h-11 rounded-lg border border-slate-600 px-3 text-sm text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
          >
            {listOpen ? "Hide list" : "Show meteor list"}
          </button>
        </div>
      </div>

      {viewMode === "solar" && !orbitsLoading && !solarKeplerReady && (
        <p className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          SBDB Keplerian elements are unavailable for the current selection —
          Sun and Earth orbit still shown. Origin details use Sentry fields.
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div
          className={`${
            listOpen ? "flex" : "hidden"
          } min-w-0 flex-col gap-3 md:flex lg:w-[300px] lg:shrink-0 xl:w-[320px]`}
        >
          <MeteorPicker
            risks={risks}
            selectedIds={selectedIds}
            primaryId={primaryId}
            onToggle={onToggle}
            onPrimary={onPrimary}
            onSelectAll={onSelectAll}
            onClear={onClear}
            className="h-[220px] sm:h-[260px] lg:h-auto lg:min-h-[240px] lg:flex-1 lg:max-h-[320px]"
          />
          <MeteorDetail
            risk={primaryRisk}
            orbit={primaryRisk ? orbits[primaryRisk.des] ?? null : null}
            loading={
              !!primaryRisk &&
              !!orbitLoading[primaryRisk.des] &&
              !orbits[primaryRisk.des]
            }
            className="max-h-[280px] lg:max-h-none lg:flex-1"
          />
        </div>

        <div className="min-w-0 flex-1">
          <EarthGlobe
            risks={risks}
            fireballs={fireballs}
            selectedIds={selectedList}
            primaryId={primaryId}
            viewMode={viewMode}
            progress={progress}
            playing={playing}
            orbits={orbits}
            orbitsLoading={orbitsLoading}
          />
          <div className="hidden md:block">
            <TrajectoryTimeline
              progress={progress}
              playing={playing}
              onProgressChange={setProgress}
              onPlayingChange={setPlaying}
              viewMode={viewMode}
              disabled={selectedList.length === 0}
            />
          </div>
        </div>
      </div>

      {/* Mobile sticky timeline — always reachable, safe-area padded */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700 bg-slate-950/95 md:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <TrajectoryTimeline
          progress={progress}
          playing={playing}
          onProgressChange={setProgress}
          onPlayingChange={setPlaying}
          viewMode={viewMode}
          disabled={selectedList.length === 0}
        />
      </div>
      <div className="h-24 md:hidden" aria-hidden />
    </div>
  );
}
