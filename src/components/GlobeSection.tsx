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
import TrajectoryTimeline, {
  type PlaybackSpeed,
} from "@/components/TrajectoryTimeline";
import DataFreshness from "@/components/DataFreshness";
import ImpactCard from "@/components/ImpactCard";
import { LABELS } from "@/lib/labels";
import Filters from "@/components/Filters";
import FireballMap from "@/components/FireballMap";
import Timeline from "@/components/Timeline";
import { formatImpactPercent } from "@/lib/format";
import { impactLatLonForDes } from "@/lib/meteorTrack";
import {
  deriveTimelineDates,
  formatDdMmYyyy,
  interpolateDate,
} from "@/lib/timelineDates";
import { useEnrichedFireballs } from "@/lib/useEnrichedFireballs";
import InfoTip from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";

const EarthGlobe = dynamic(() => import("@/components/EarthGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[42vh] min-h-[240px] items-center justify-center rounded-xl border border-slate-700 bg-slate-950 sm:h-[min(70vh,720px)] sm:min-h-[420px]">
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
  /** Object ids that should show [NEW] after a refresh */
  newIds?: Set<string>;
  newBadgeHours?: number;
  showPlanets?: boolean;
  showFireballs?: boolean;
  onShowPlanetsChange?: (v: boolean) => void;
  onShowFireballsChange?: (v: boolean) => void;
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
  newIds,
  newBadgeHours = 24,
  showPlanets: showPlanetsProp,
  showFireballs: showFireballsProp,
  onShowPlanetsChange,
  onShowFireballsChange,
}: Props) {
  const cardRisks = listRisks ?? risks;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [tab, setTab] = useState<TabId | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [lodMode, setLodMode] = useState<LodMode>("earth");
  const [showFireballsLocal, setShowFireballsLocal] = useState(true);
  const [showPlanetsLocal, setShowPlanetsLocal] = useState(true);
  const showFireballs = showFireballsProp ?? showFireballsLocal;
  const showPlanets = showPlanetsProp ?? showPlanetsLocal;
  const locatedFireballs = useEnrichedFireballs(fireballs);
  const setShowFireballs = onShowFireballsChange ?? setShowFireballsLocal;
  const setShowPlanets = onShowPlanetsChange ?? setShowPlanetsLocal;
  void setShowPlanets; // planets toggle lives in the top toolbar
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

  const idsKey = useMemo(
    () => cardRisks.map(riskId).join("|"),
    [cardRisks]
  );

  useEffect(() => {
    if (cardRisks.length === 0) {
      setSelectedIds(new Set());
      setPrimaryId(null);
      setInitialized(true);
      return;
    }
    if (!initialized) {
      // Prefer highest-IP slice for initial globe selection when available
      const seed = (risks.length ? risks : cardRisks).slice(
        0,
        Math.min(DEFAULT_SELECT, risks.length || cardRisks.length)
      );
      setSelectedIds(new Set(seed.map(riskId)));
      setPrimaryId(seed[0] ? riskId(seed[0]) : null);
      setInitialized(true);
      return;
    }
    setSelectedIds((prev) => {
      const valid = new Set(cardRisks.map(riskId));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      // Keep newly appeared list objects selectable — do not drop them
      if (next.size === 0 && cardRisks.length > 0) {
        const seed = (risks.length ? risks : cardRisks).slice(
          0,
          Math.min(DEFAULT_SELECT, risks.length || cardRisks.length)
        );
        seed.forEach((r) => next.add(riskId(r)));
      }
      return next;
    });
    setPrimaryId((prev) => {
      const valid = new Set(cardRisks.map(riskId));
      if (prev && valid.has(prev)) return prev;
      const seed = risks[0] ?? cardRisks[0];
      return seed ? riskId(seed) : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync when full list id set changes
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
    const pool = cardRisks;
    setSelectedIds(new Set(pool.map(riskId)));
    setPrimaryId((prev) => prev ?? (pool[0] ? riskId(pool[0]) : null));
  }, [cardRisks]);

  const onSelectIds = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    setPrimaryId((prev) =>
      prev && ids.includes(prev) ? prev : ids[0] ?? null
    );
  }, []);

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
    if (!primaryId) return null;
    return (
      cardRisks.find((r) => riskId(r) === primaryId) ??
      risks.find((r) => riskId(r) === primaryId) ??
      null
    );
  }, [primaryId, cardRisks, risks]);

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
    return d ? formatDdMmYyyy(d) : undefined;
  }, [timelineDates, progress]);

  useEffect(() => {
    const dess = Array.from(
      new Set(
        cardRisks
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
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        const next =
          progressRef.current + (dt * playbackSpeed) / LOOP_SECONDS;
        if (next >= 1) {
          // End of time bar: clamp, stop (no loop). EarthGlobe zooms out.
          progressRef.current = 1;
          setProgress(1);
          setPlaying(false);
          return;
        }
        progressRef.current = next;
        // Throttle React UI updates (~15fps) so the 3D canvas stays smooth
        if (now - lastUi > 66) {
          lastUi = now;
          setProgress(progressRef.current);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, playbackSpeed]);

  const orbitsLoading = useMemo(() => {
    if (!primaryRisk) {
      return selectedList.some((id) => {
        const r =
          cardRisks.find((x) => riskId(x) === id) ??
          risks.find((x) => riskId(x) === id);
        return r ? orbitLoading[r.des] && !orbits[r.des] : false;
      });
    }
    return !!orbitLoading[primaryRisk.des] && !orbits[primaryRisk.des];
  }, [orbitLoading, orbits, primaryRisk, selectedList, risks]);

  /** Globe must include every selected list object — not only top-IP subset */
  const globeRenderRisks = useMemo(() => {
    const map = new Map<string, (typeof risks)[0]>();
    for (const r of risks) map.set(riskId(r), r);
    for (const r of cardRisks) {
      const id = riskId(r);
      if (selectedIds.has(id)) map.set(id, r);
    }
    if (primaryId) {
      const hit = cardRisks.find((r) => riskId(r) === primaryId);
      if (hit) map.set(primaryId, hit);
    }
    return Array.from(map.values());
  }, [risks, cardRisks, selectedIds, primaryId]);

  const top = cardRisks[0];

  const toggleTab = (id: TabId) => {
    setTab((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-0">
      {/* Hero globe — top center */}
      <div className="mx-auto w-full max-w-6xl">
        <EarthGlobe
          risks={globeRenderRisks}
          fireballs={locatedFireballs}
          showFireballs={showFireballs}
          showPlanets={showPlanets}
          impactCountry={impactCountry}
          impactCountryReady={impactCountryReady}
          selectedIds={selectedList}
          primaryId={primaryId}
          progress={progress}
          progressRef={progressRef}
          playing={playing}
          orbits={orbits}
          orbitsLoading={orbitsLoading}
          onLodChange={({ mode }) => setLodMode(mode)}
        />
        {/* Slim timeline directly under globe */}
        <TrajectoryTimeline
          progress={progress}
          playing={playing}
          onProgressChange={(t) => {
            progressRef.current = t;
            setProgress(t);
          }}
          onPlayingChange={(p) => {
            if (p && progressRef.current >= 0.99) {
              // Play from the end: restart the full story from the start
              progressRef.current = 0;
              setProgress(0);
            }
            setPlaying(p);
          }}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={setPlaybackSpeed}
          lodMode={lodMode}
          labelStart={timelineDates.labelStart}
          labelMid={labelMid}
          labelEnd={timelineDates.labelEnd}
          disabled={selectedList.length === 0}
          compact
          className="overflow-visible rounded-b-xl"
        />
      </div>

      {/* Function tab strip */}
      <div className="mx-auto mt-3 w-full max-w-6xl">
        <div
          className="no-scrollbar flex gap-1 overflow-x-auto overscroll-x-contain rounded-xl border border-slate-700/80 bg-slate-950/80 p-1"
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
            className="mt-2 rounded-xl border border-slate-700/80 bg-slate-950/90 p-3 sm:p-4"
          >
            {tab === "meteors" && (
              <div className="space-y-3">
                {onMinIpChange && (
                  <Filters minIp={minIp} onMinIpChange={onMinIpChange} />
                )}
                <p className="text-[10px] leading-relaxed text-slate-500">
                  Grouped by discovery year. Type in the search box to filter.
                  Objects that appear after a refresh show{" "}
                  <span className="font-semibold text-lime-400">{LABELS.newBadge}</span>{" "}
                  for {newBadgeHours}h on this device only.
                </p>
                <MeteorPicker
                  newIds={newIds}
                  risks={cardRisks}
                  selectedIds={selectedIds}
                  primaryId={primaryId}
                  onToggle={onToggle}
                  onPrimary={onPrimary}
                  onSelectAll={onSelectAll}
                  onSelectIds={onSelectIds}
                  onClear={onClear}
                  className="max-h-none"
                />
                {cardRisks.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                        Risk cards
                      </span>
                      <span>
                        ({cardRisks.length}
                        {totalRiskCount != null && totalRiskCount !== cardRisks.length
                          ? ` of ${totalRiskCount}`
                          : ""}
                        )
                      </span>
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {cardRisks.slice(0, 30).map((ev, i) => (
                        <ImpactCard
                          key={ev.id || ev.des}
                          event={ev}
                          rank={i + 1}
                          isNew={newIds?.has(riskId(ev)) ?? false}
                        />
                      ))}
                    </div>
                    {cardRisks.length > 30 && (
                      <p className="mt-2 text-center text-xs text-slate-500">
                        Showing top 30. Raise the Minimum Impact Probability (Min IP) filter to focus.
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
                  className=""
                />
                {top && (
                  <div className="space-y-3">
                    <ImpactCard event={top} rank={1} isNew={newIds?.has(riskId(top)) ?? false} hero />
                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                      <p className="text-xs uppercase text-slate-500">
                        Highest Impact Probability (IP) — filtered
                      </p>
                      <p className="mt-1 font-mono text-3xl font-bold text-amber-300">
                        {formatImpactPercent(top.ip)}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {top.fullname || top.des} · Virtual Impactor Years (VI years) {top.range}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "activity" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs leading-relaxed text-slate-300">
                  <strong className="inline-flex items-center gap-1.5 text-slate-100">
                    Fireballs
                    <InfoTip
                      text={TIPS.fireballs}
                      label={`About ${LABELS.fireballs}`}
                    />
                  </strong>{" "}
                  are very
                  bright meteors — space rocks that already entered Earth&apos;s
                  atmosphere and flared. This feed is from NASA/JPL US-sensor
                  detections (time, energy, often lat/lon). They are past events,
                  not the same as Sentry&apos;s future impact-risk asteroids.{" "}
                  <span className="inline-flex items-center gap-1">
                    <span>
                      Spotted location is the country or ocean region of each
                      event — never your device location.
                    </span>
                    <InfoTip
                      text={TIPS.fireballSpotted}
                      label={`About ${LABELS.fireballSpotted}`}
                    />
                  </span>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200">
                  <span>Show fireballs on the 3D map</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-cyan-500"
                    checked={showFireballs}
                    onChange={(e) => setShowFireballs(e.target.checked)}
                    aria-label="Toggle fireball visuals on the globe"
                  />
                </label>
                <div className="grid gap-3 lg:grid-cols-2">
                  {showFireballs ? (
                    <FireballMap fireballs={locatedFireballs} />
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 text-center text-xs text-slate-500">
                      Fireball map hidden — turn the toggle on to view.
                    </div>
                  )}
                  <Timeline approaches={approaches} fireballs={locatedFireballs} />
                </div>
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
                    Auto-refresh every 2 minutes · NASA/JPL {LABELS.sentry} ·{" "}
                    {LABELS.cad} · {LABELS.fireballs} · {LABELS.sbdb}
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
                  orbit, and selected Near-Earth Object (NEO) Sun-centered paths from the
                  Small-Body Database (SBDB). Use the
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
