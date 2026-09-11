"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  CloseApproach,
  Fireball,
  OrbitElements,
  RiskEvent,
  SentryDetailResponse,
} from "@/types/neo";
import type { LodMode } from "@/components/EarthGlobe";
import MeteorPicker from "@/components/MeteorPicker";
import MeteorDetail from "@/components/MeteorDetail";
import TrajectoryTimeline from "@/components/TrajectoryTimeline";
import DataFreshness from "@/components/DataFreshness";
import ImpactCard from "@/components/ImpactCard";
import Filters from "@/components/Filters";
import FireballMap from "@/components/FireballMap";
import Timeline from "@/components/Timeline";
import { formatImpactPercent } from "@/lib/format";
import { impactLatLonForDes } from "@/lib/meteorTrack";
import {
  deriveTimelineDates,
  formatDdMmYy,
  interpolateDate,
} from "@/lib/timelineDates";

const EarthGlobe = dynamic(() => import("@/components/EarthGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[55vh] min-h-[280px] items-center justify-center rounded-xl border border-slate-700 bg-slate-950 sm:h-[min(70vh,720px)] sm:min-h-[420px]">
      <p className="text-sm text-slate-500">Loading 3D globe…</p>
    </div>
  ),
});

const DEFAULT_SELECT = 3;
const LOOP_SECONDS = 8;

type TabId = "meteors" | "details" | "activity" | "about";

const TABS: { id: TabId; label: string }[] = [
  { id: "meteors", label: "Meteors" },
  { id: "details", label: "Details" },
  { id: "activity", label: "Activity" },
  { id: "about", label: "About" },
];

function riskId(r: RiskEvent): string {
  return r.id || r.des;
}

type Props = {
  risks: RiskEvent[];
  /** Full filtered list for risk cards (may be larger than globe subset) */
  listRisks?: RiskEvent[];
  totalRiskCount?: number;
  fireballs: Fireball[];
  approaches?: CloseApproach[];
  updatedAt?: Date | null;
  minIp?: number;
  onMinIpChange?: (v: number) => void;
  onRefresh?: () => void;
};

export default function GlobeSection({
  risks,
  listRisks,
  totalRiskCount,
  fireballs,
  approaches = [],
  updatedAt,
  minIp = 0,
  onMinIpChange,
  onRefresh,
}: Props) {
  const cardRisks = listRisks ?? risks;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [tab, setTab] = useState<TabId | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [lodMode, setLodMode] = useState<LodMode>("earth");
  const [orbits, setOrbits] = useState<Record<string, OrbitElements>>({});
  const [orbitLoading, setOrbitLoading] = useState<Record<string, boolean>>({});
  const orbitCache = useRef<Record<string, OrbitElements>>({});
  const orbitInflight = useRef<Set<string>>(new Set());
  const [sentryDetail, setSentryDetail] = useState<SentryDetailResponse | null>(
    null
  );
  const [impactCountry, setImpactCountry] = useState<string | null>(null);
  const [impactCountryReady, setImpactCountryReady] = useState(false);
  const countryCache = useRef<Record<string, string | null>>({});
  const sentryCache = useRef<Record<string, SentryDetailResponse>>({});

  const idsKey = useMemo(() => risks.map(riskId).join("|"), [risks]);

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
    setTab("details");
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

  // Fetch Sentry object detail (VI table / first_obs) for timeline dates
  useEffect(() => {
    if (!primaryRisk?.des) {
      setSentryDetail(null);
      return;
    }
    const des = primaryRisk.des;
    if (sentryCache.current[des]) {
      setSentryDetail(sentryCache.current[des]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sentry/${encodeURIComponent(des)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json.error) {
          setSentryDetail(null);
          return;
        }
        const detail = json as SentryDetailResponse;
        sentryCache.current[des] = detail;
        setSentryDetail(detail);
      } catch {
        if (!cancelled) setSentryDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryRisk?.des]);

  // Reverse-geocode illustrative path endpoint → potential impact country
  useEffect(() => {
    if (!primaryRisk?.des) {
      setImpactCountry(null);
      setImpactCountryReady(false);
      return;
    }
    const des = primaryRisk.des;
    const idx = risks.findIndex((r) => riskId(r) === riskId(primaryRisk));
    const { lat, lon } = impactLatLonForDes(des, idx >= 0 ? idx : 0);
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (key in countryCache.current) {
      setImpactCountry(countryCache.current[key]);
      setImpactCountryReady(true);
      return;
    }
    let cancelled = false;
    setImpactCountryReady(false);
    (async () => {
      try {
        const res = await fetch(
          `/api/geocode?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`
        );
        const json = await res.json();
        if (cancelled) return;
        const country =
          typeof json.country === "string" && json.country.trim()
            ? json.country.trim()
            : null;
        countryCache.current[key] = country;
        setImpactCountry(country);
      } catch {
        if (!cancelled) {
          countryCache.current[key] = null;
          setImpactCountry(null);
        }
      } finally {
        if (!cancelled) setImpactCountryReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryRisk, risks]);

  const timelineDates = useMemo(
    () =>
      deriveTimelineDates(
        primaryRisk,
        sentryDetail,
        primaryRisk ? orbits[primaryRisk.des] : null
      ),
    [primaryRisk, sentryDetail, orbits]
  );

  const labelMid = useMemo(() => {
    const d = interpolateDate(
      timelineDates.start,
      timelineDates.end,
      progress
    );
    return d ? formatDdMmYy(d) : undefined;
  }, [timelineDates, progress]);

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

  const orbitsLoading = useMemo(() => {
    if (!primaryRisk) {
      return selectedList.some((id) => {
        const r = risks.find((x) => riskId(x) === id);
        return r ? orbitLoading[r.des] && !orbits[r.des] : false;
      });
    }
    return !!orbitLoading[primaryRisk.des] && !orbits[primaryRisk.des];
  }, [orbitLoading, orbits, primaryRisk, selectedList, risks]);

  const top = cardRisks[0];

  const toggleTab = (id: TabId) => {
    setTab((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-0">
      {/* Hero globe — top center */}
      <div className="mx-auto w-full max-w-6xl">
        <EarthGlobe
          risks={risks}
          fireballs={fireballs}
          selectedIds={selectedList}
          primaryId={primaryId}
          progress={progress}
          playing={playing}
          orbits={orbits}
          orbitsLoading={orbitsLoading}
          onLodChange={({ mode }) => setLodMode(mode)}
        />

        {/* Slim timeline directly under globe */}
        <TrajectoryTimeline
          progress={progress}
          playing={playing}
          onProgressChange={setProgress}
          onPlayingChange={setPlaying}
          lodMode={lodMode}
          labelStart={timelineDates.labelStart}
          labelMid={labelMid}
          labelEnd={timelineDates.labelEnd}
          impactCountry={impactCountryReady ? impactCountry : undefined}
          disabled={selectedList.length === 0}
          compact
          className="rounded-b-xl border border-t-0 border-slate-700/80"
        />
      </div>

      {/* Function tab strip */}
      <div className="mx-auto mt-3 w-full max-w-6xl">
        <div
          className="flex gap-1 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/80 p-1"
          role="tablist"
          aria-label="Dashboard panels"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => toggleTab(t.id)}
                className={`min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition ${
                  active
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-900 hover:text-cyan-200"
                }`}
              >
                {t.label}
                {t.id === "meteors" && selectedIds.size > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active ? "bg-slate-950/20" : "bg-slate-800 text-cyan-300"
                    }`}
                  >
                    {selectedIds.size}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab && (
          <div
            role="tabpanel"
            className="mt-2 max-h-[min(52vh,560px)] overflow-y-auto overscroll-contain rounded-xl border border-slate-700/80 bg-slate-950/90 p-3 sm:p-4"
          >
            {tab === "meteors" && (
              <div className="space-y-3">
                {onMinIpChange && (
                  <Filters minIp={minIp} onMinIpChange={onMinIpChange} />
                )}
                <MeteorPicker
                  risks={risks}
                  selectedIds={selectedIds}
                  primaryId={primaryId}
                  onToggle={onToggle}
                  onPrimary={onPrimary}
                  onSelectAll={onSelectAll}
                  onClear={onClear}
                  className="h-[min(42vh,420px)]"
                />
                {cardRisks.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Risk cards ({cardRisks.length}
                      {totalRiskCount != null && totalRiskCount !== cardRisks.length
                        ? ` of ${totalRiskCount}`
                        : ""}
                      )
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {cardRisks.slice(0, 30).map((ev, i) => (
                        <ImpactCard
                          key={ev.id || ev.des}
                          event={ev}
                          rank={i + 1}
                        />
                      ))}
                    </div>
                    {cardRisks.length > 30 && (
                      <p className="mt-2 text-center text-xs text-slate-500">
                        Showing top 30. Raise min IP in filters to focus.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "details" && (
              <div className="grid gap-3 lg:grid-cols-2">
                <MeteorDetail
                  risk={primaryRisk}
                  orbit={primaryRisk ? orbits[primaryRisk.des] ?? null : null}
                  loading={
                    !!primaryRisk &&
                    !!orbitLoading[primaryRisk.des] &&
                    !orbits[primaryRisk.des]
                  }
                  className="min-h-[240px]"
                />
                {top && (
                  <div className="space-y-3">
                    <ImpactCard event={top} rank={1} hero />
                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                      <p className="text-xs uppercase text-slate-500">
                        Highest IP (filtered)
                      </p>
                      <p className="mt-1 font-mono text-3xl font-bold text-amber-300">
                        {formatImpactPercent(top.ip)}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {top.fullname || top.des} · VI years {top.range}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "activity" && (
              <div className="grid gap-3 lg:grid-cols-2">
                <FireballMap fireballs={fireballs} />
                <Timeline approaches={approaches} fireballs={fireballs} />
              </div>
            )}

            {tab === "about" && (
              <div className="space-y-3 text-sm text-slate-300">
                <DataFreshness updatedAt={updatedAt ?? null} />
                <div className="flex flex-wrap items-center gap-2">
                  {onRefresh && (
                    <button
                      type="button"
                      onClick={onRefresh}
                      className="min-h-10 rounded-lg border border-slate-600 px-3 text-sm text-slate-200 hover:border-cyan-600 hover:text-cyan-300"
                    >
                      Refresh now
                    </button>
                  )}
                  <p className="text-xs text-slate-500">
                    Auto-refresh every 2 minutes · NASA/JPL Sentry · CAD ·
                    Fireball · SBDB
                  </p>
                </div>
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
                  <strong>Disclaimer:</strong> Sentry impact probabilities are
                  statistical over decades-to-centuries. A high-ranking tiny
                  asteroid can show a large % while remaining harmless. This MVP
                  is for monitoring & education — not emergency alerts.
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Zoom the 3D view continuously: close in for atmospheric
                  meteor trails on Earth; pull out for the Sun, Earth&apos;s
                  orbit, and selected NEO heliocentric paths from SBDB. Use the
                  thin timeline under the globe to scrub trajectories.
                </p>
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                  <strong className="text-slate-100">Privacy:</strong> No
                  accounts, identity cookies, localStorage of personal data, or
                  analytics. We do not collect your name, email, or location.
                  The browser only talks to this app&apos;s{" "}
                  <code className="text-slate-400">/api/*</code> routes (plus
                  static Earth textures). NASA/JPL and reverse-geocode calls run
                  on the server; geocode uses asteroid path coordinates only —
                  never your IP or device location. Hosting providers may still
                  keep standard server logs (e.g. IP) outside this app&apos;s
                  control.
                </div>
              </div>
            )}
          </div>
        )}

        {!tab && (
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Open a tab for meteors, details, activity, or about ·{" "}
            {selectedIds.size} on globe
          </p>
        )}
      </div>

    </div>
  );
}
