"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrbitElements, RiskEvent } from "@/types/neo";
import InfoTip, { LabelWithInfo } from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";
import { LABELS } from "@/lib/labels";
import {
  formatDiameterKm,
  formatImpactPercent,
  formatPalermo,
  torinoColor,
} from "@/lib/format";

type Props = {
  risk: RiskEvent | null;
  className?: string;
  /** When provided (including null), skip internal SBDB fetch */
  orbit?: OrbitElements | null;
  loading?: boolean;
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

export default function MeteorDetail({
  risk,
  className,
  orbit: orbitProp,
  loading: loadingProp,
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
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-xl shadow-cyan-950/20 ${className ?? ""}`}
    >
      <div className="shrink-0 border-b border-slate-800 px-3 py-2.5">
        <LabelWithInfo
          tip={TIPS.focusedMeteor}
          className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90"
        >
          Focused meteor
        </LabelWithInfo>
        <h3 className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold text-slate-100">
          <span className="truncate">{displayName(risk)}</span>
          <InfoTip text={TIPS.designation} label="About this name" />
        </h3>
        {displayName(risk) !== risk.des && (
          <p className="font-mono text-[10px] text-slate-500">{risk.des}</p>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 text-xs">
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
            <dt>
              <LabelWithInfo tip={TIPS.lastObs} className="text-slate-500">
                {LABELS.lastObs}
              </LabelWithInfo>
            </dt>
            <dd className="font-mono text-slate-200">{risk.last_obs || "—"}</dd>
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
                <dt><LabelWithInfo tip={TIPS.lastObs} className="text-slate-500">{LABELS.firstObs}</LabelWithInfo></dt>
                <dd className="font-mono text-slate-200">
                  {orbit.firstObs ?? "—"}
                </dd>
              </div>
              <div>
                <dt><LabelWithInfo tip="How many days of observations span the orbit fit — longer arcs are usually more reliable." className="text-slate-500">{LABELS.dataArc}</LabelWithInfo></dt>
                <dd className="font-mono text-slate-200">
                  {orbit.dataArc ?? "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <p className="leading-relaxed text-[11px] text-slate-400">{blurb}</p>
      </div>
    </aside>
  );
}
