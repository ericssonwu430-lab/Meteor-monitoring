"use client";

import { useEffect, useMemo, useState } from "react";
import type { HorizonsEphemeris, OrbitElements, RiskEvent } from "@/types/neo";
import InfoTip, { LabelWithInfo } from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";
import { LABELS } from "@/lib/labels";
import {
  formatApparentMag,
  formatDeltaAu,
  formatDiameterKm,
  formatDistanceKm,
  formatImpactPercent,
  formatLightTravel,
  formatPalermo,
  formatUpdatedAgo,
  torinoColor,
} from "@/lib/format";
import { formatDisplayDate } from "@/lib/timelineDates";

type Props = {
  risk: RiskEvent | null;
  className?: string;
  /** When provided (including null), skip internal SBDB fetch */
  orbit?: OrbitElements | null;
  loading?: boolean;
  ephemeris?: HorizonsEphemeris | null;
  ephemerisLoading?: boolean;
  ephemerisError?: string | null;
};

function displayName(r: RiskEvent): string {
  const full = (r.fullname || "").trim();
  if (full && full !== r.des) return full;
  return r.des || r.id || "Unknown";
}

function buildBlurb(r: RiskEvent, orbit: OrbitElements | null): string {
  const ip = formatImpactPercent(r.ip);
  const className = orbit?.orbitClass;
  if (className) {
    return `Near-Earth asteroid on a ${className}-type orbit; cumulative Earth impact probability ${ip} over ${r.range || "its VI window"} (Sentry). Origin here means dynamical orbit class and elements from public JPL SBDB — not a physical birthplace.`;
  }
  return `Near-Earth object tracked by NASA/JPL Sentry; cumulative Earth impact probability ${ip} over ${r.range || "its VI window"}. Orbit-class origin from SBDB is unavailable — showing Sentry risk fields only.`;
}

function Amber({ children }: { children: string }) {
  return <span className="font-medium text-amber-300">{children}</span>;
}

function Cyan({ children }: { children: string }) {
  return <span className="font-mono text-cyan-300">{children}</span>;
}

export default function MeteorDetail({
  risk,
  className,
  orbit: orbitProp,
  loading: loadingProp,
  ephemeris = null,
  ephemerisLoading = false,
  ephemerisError = null,
}: Props) {
  const controlled = orbitProp !== undefined || loadingProp !== undefined;
  const [orbitLocal, setOrbit] = useState<OrbitElements | null>(null);
  const [loadingLocal, setLoading] = useState(false);

  useEffect(() => {
    if (controlled) return;
    if (!risk?.des) {
      setOrbit(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setOrbit(null);
    (async () => {
      try {
        const res = await fetch(`/api/sbdb/${encodeURIComponent(risk.des)}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.orbit) setOrbit(json.orbit as OrbitElements);
        else
          setOrbit({
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
          });
      } catch {
        if (!cancelled)
          setOrbit({
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
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [controlled, risk?.des]);

  const orbit = controlled ? orbitProp ?? null : orbitLocal;
  const loading = controlled ? !!loadingProp : loadingLocal;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!ephemeris) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ephemeris]);

  const blurb = useMemo(
    () => (risk ? buildBlurb(risk, orbit) : ""),
    [risk, orbit]
  );

  if (!risk) {
    return (
      <aside
        className={`rounded-xl border border-slate-700/80 bg-slate-950/90 p-4 text-sm text-slate-500 ${className ?? ""}`}
      >
        Select a meteor to see brief details and origin (orbit class).
      </aside>
    );
  }

  const ip = parseFloat(risk.ip) || 0;
  const vInf = risk.v_inf ? parseFloat(risk.v_inf) : NaN;

  return (
    <aside
      className={`flex flex-col rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-xl shadow-cyan-950/20 ${className ?? ""}`}
    >
      <div className="shrink-0 border-b border-slate-800 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90">
          Focused meteor
        </p>
        <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-100">
          {displayName(risk)}
        </h3>
        {displayName(risk) !== risk.des && (
          <p className="font-mono text-[10px] text-slate-500">{risk.des}</p>
        )}
      </div>

      <div className="space-y-3 px-3 py-3 text-xs">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/80 px-2 py-0.5 font-mono font-semibold text-amber-300">
            {formatImpactPercent(ip)}
            <InfoTip text={TIPS.impactProbability} label={`About ${LABELS.impactProbability}`} />
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${torinoColor(risk.ts_max)}`}
          >
            {LABELS.torino} {risk.ts_max ?? "0"}
            <InfoTip text={TIPS.torino} label={`About ${LABELS.torino}`} />
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-indigo-900/80 px-1.5 py-0.5 text-indigo-200">
            {LABELS.palermo} {formatPalermo(risk.ps_max)}
            <InfoTip text={TIPS.palermo} label={`About ${LABELS.palermo}`} />
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
            {LABELS.diameter} {formatDiameterKm(risk.diameter)}
            <InfoTip text={TIPS.diameter} label={`About ${LABELS.diameter}`} />
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
            {LABELS.absoluteMagnitude}={risk.h}
            <InfoTip text={TIPS.absoluteMagnitude} label={`About ${LABELS.absoluteMagnitude}`} />
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <div>
            <dt>
              <LabelWithInfo tip={TIPS.viYears} className="text-slate-500">
                {LABELS.viYears}
              </LabelWithInfo>
            </dt>
            <dd className="font-mono text-slate-200">{risk.range || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{LABELS.lastObs}</dt>
            <dd className="font-mono text-slate-200">{formatDisplayDate(risk.last_obs)}</dd>
          </div>
          <div>
            <dt>
              <LabelWithInfo tip={TIPS.vInf} className="text-slate-500">
                {LABELS.vInf}
              </LabelWithInfo>
            </dt>
            <dd className="font-mono text-slate-200">
              {Number.isFinite(vInf) ? `${vInf.toFixed(2)} km/s` : "—"}
            </dd>
          </div>
          <div>
            <dt>
              <LabelWithInfo tip={TIPS.virtualImpactors} className="text-slate-500">
                {LABELS.virtualImpactors}
              </LabelWithInfo>
            </dt>
            <dd className="font-mono text-slate-200">{risk.n_imp}</dd>
          </div>
        </dl>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
          <LabelWithInfo
            tip={TIPS.originOrbit}
            className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/90"
          >
            {LABELS.originOrbit}
          </LabelWithInfo>
          {loading && (
            <p className="mt-1 text-[11px] text-slate-500">Loading {LABELS.sbdb}…</p>
          )}
          {!loading && orbit && !orbit.available && (
            <p className="mt-1 text-[11px] text-amber-200/80">
              {LABELS.sbdb} orbit unavailable{orbit.error ? `: ${orbit.error}` : ""}.
              {LABELS.sentry} fields above still apply.
            </p>
          )}
          {!loading && orbit?.available && (
            <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div className="col-span-2">
                <dt><LabelWithInfo tip={TIPS.originOrbit} className="text-slate-500">{LABELS.orbitClass}</LabelWithInfo></dt>
                <dd className="font-medium text-violet-200">
                  {orbit.orbitClass}
                  {orbit.orbitClassCode ? ` (${orbit.orbitClassCode})` : ""}
                </dd>
              </div>
              <div>
                <dt><LabelWithInfo tip={TIPS.semiMajor} className="text-slate-500">{LABELS.semiMajor}</LabelWithInfo></dt>
                <dd className="font-mono text-slate-200">
                  {orbit.a?.toPrecision(4) ?? "—"}
                </dd>
              </div>
              <div>
                <dt><LabelWithInfo tip={TIPS.eccentricity} className="text-slate-500">{LABELS.eccentricity}</LabelWithInfo></dt>
                <dd className="font-mono text-slate-200">
                  {orbit.e?.toPrecision(4) ?? "—"}
                </dd>
              </div>
              <div>
                <dt><LabelWithInfo tip={TIPS.inclination} className="text-slate-500">{LABELS.inclination}</LabelWithInfo></dt>
                <dd className="font-mono text-slate-200">
                  {orbit.i?.toPrecision(3) ?? "—"}
                </dd>
              </div>
              <div>
                <dt><LabelWithInfo tip={TIPS.semiMajor} className="text-slate-500">{LABELS.periAp}</LabelWithInfo></dt>
                <dd className="font-mono text-slate-200">
                  {orbit.q?.toPrecision(3) ?? "—"} /{" "}
                  {orbit.ad?.toPrecision(3) ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{LABELS.firstObs}</dt>
                <dd className="font-mono text-slate-200">
                  {formatDisplayDate(orbit.firstObs)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{LABELS.dataArc}</dt>
                <dd className="font-mono text-slate-200">
                  {orbit.dataArc ?? "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <div className="rounded-lg border border-cyan-900/40 bg-slate-900/60 p-2.5">
          <LabelWithInfo
            tip={TIPS.liveSky}
            className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90"
          >
            {LABELS.liveSky}
          </LabelWithInfo>
          {ephemerisLoading && !ephemeris && (
            <p className="mt-1 text-[11px] text-slate-500">
              Loading live sky position from {LABELS.horizons}…
            </p>
          )}
          {!ephemerisLoading && !ephemeris && (
            <p className="mt-1 text-[11px] text-amber-200/80">
              Live sky position unavailable
              {ephemerisError ? `: ${ephemerisError}` : " — Horizons could not resolve this designation"}.
            </p>
          )}
          {ephemeris && (
            <>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Updated {formatUpdatedAgo(ephemeris.asOf, nowMs)}
                </span>
                <span className="font-mono text-[10px] text-cyan-400/90">
                  as of {formatDisplayDate(ephemeris.asOf)}
                </span>
              </div>
              <p className="mt-1.5 leading-relaxed text-[11px] text-slate-300">
                <Amber>{ephemeris.name}</Amber>
                {" is in the constellation of "}
                <Amber>{ephemeris.constellation}</Amber>
                {", at a distance of "}
                <Cyan>{formatDistanceKm(ephemeris.distanceKm)}</Cyan>
                {" kilometers from Earth. The current Right Ascension is "}
                <Cyan>{ephemeris.ra}</Cyan>
                {" and the Declination is "}
                <Cyan>{ephemeris.dec}</Cyan>
                {" ("}
                <span className="inline-flex items-center gap-1">
                  apparent coordinates
                  <InfoTip
                    text={TIPS.apparentCoords}
                    label={`About ${LABELS.apparentCoords}`}
                  />
                </span>
                {"). The magnitude of "}
                <Amber>{ephemeris.name}</Amber>
                {" is "}
                <Cyan>{formatApparentMag(ephemeris.magnitude)}</Cyan>
                {"."}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <div>
                  <dt>
                    <LabelWithInfo tip={TIPS.geocentricDistance} className="text-slate-500">
                      {LABELS.geocentricDistance}
                    </LabelWithInfo>
                  </dt>
                  <dd className="font-mono text-cyan-300">
                    {formatDistanceKm(ephemeris.distanceKm)} km
                  </dd>
                </div>
                <div>
                  <dt>
                    <LabelWithInfo tip={TIPS.distanceAu} className="text-slate-500">
                      {LABELS.distanceAu}
                    </LabelWithInfo>
                  </dt>
                  <dd className="font-mono text-cyan-300">
                    {formatDeltaAu(ephemeris.deltaAu)} AU
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt>
                    <LabelWithInfo tip={TIPS.lightTravel} className="text-slate-500">
                      {LABELS.lightTravel}
                    </LabelWithInfo>
                  </dt>
                  <dd className="font-mono text-cyan-300">
                    {formatLightTravel(ephemeris.lightTravelSeconds)}
                  </dd>
                </div>
              </dl>
              <p className="mt-1.5 text-[10px] text-slate-500">
                Live apparent geocentric from{" "}
                <span className="text-slate-400">{LABELS.horizons}</span>
                {" (CENTER=500@399) · Alt/Az needs an observer site so we stay Earth-centered · constellation is approximate from apparent RA/Dec"}
              </p>
            </>
          )}
        </div>

        <p className="leading-relaxed text-[11px] text-slate-400">{blurb}</p>
      </div>
    </aside>
  );
}
