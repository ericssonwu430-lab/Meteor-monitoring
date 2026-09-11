"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ImpactCard from "@/components/ImpactCard";
import FireballMap from "@/components/FireballMap";
import Timeline from "@/components/Timeline";
import Filters from "@/components/Filters";
import GlobeSection from "@/components/GlobeSection";
import type { CloseApproach, Fireball, RiskEvent } from "@/types/neo";
import { formatImpactPercent } from "@/lib/format";

const REFRESH_MS = 120_000;
const GLOBE_RISKS = 20;

export default function DashboardPage() {
  const [risks, setRisks] = useState<RiskEvent[]>([]);
  const [approaches, setApproaches] = useState<CloseApproach[]>([]);
  const [fireballs, setFireballs] = useState<Fireball[]>([]);
  const [minIp, setMinIp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [sRes, cRes, fRes] = await Promise.all([
        fetch("/api/sentry"),
        fetch("/api/cad"),
        fetch("/api/fireballs"),
      ]);
      if (!sRes.ok || !cRes.ok || !fRes.ok) {
        throw new Error("One or more API routes failed");
      }
      const sJson = await sRes.json();
      const cJson = await cRes.json();
      const fJson = await fRes.json();
      if (sJson.error) throw new Error(sJson.error);
      if (cJson.error) throw new Error(cJson.error);
      if (fJson.error) throw new Error(fJson.error);

      const list: RiskEvent[] = Array.isArray(sJson.data) ? sJson.data : [];
      list.sort((a, b) => parseFloat(b.ip) - parseFloat(a.ip));
      setRisks(list);
      setApproaches(cJson.approaches ?? []);
      setFireballs(fJson.fireballs ?? []);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(
    () => risks.filter((r) => parseFloat(r.ip) >= minIp),
    [risks, minIp]
  );

  const globeRisks = useMemo(
    () => filtered.slice(0, GLOBE_RISKS),
    [filtered]
  );

  const top = filtered[0];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50 md:text-3xl">
              NEO Impact Risk Dashboard
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Ranked by cumulative impact probability from NASA/JPL Sentry.
              Auto-refreshes every 2 minutes.
            </p>
          </div>
          <div className="text-left text-xs text-slate-400 sm:text-right">
            <p className="text-sm text-slate-200">
              Data as of{" "}
              <span className="font-semibold text-cyan-300">
                {updatedAt
                  ? updatedAt.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            </p>
            <p className="mt-0.5">Auto-refreshes every 2 minutes</p>
            <button
              type="button"
              onClick={() => {
                if (risks.length === 0) setLoading(true);
                load();
              }}
              className="mt-2 min-h-11 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
            >
              Refresh now
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
          <strong>Disclaimer:</strong> Sentry impact probabilities are
          statistical over decades-to-centuries. A high-ranking tiny asteroid
          can show a large % while remaining harmless. This MVP is for
          monitoring & education — not emergency alerts.
        </div>
      </section>

      {loading && risks.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center text-slate-400">
          Loading Sentry / CAD / Fireball / SBDB data…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          Error: {error}
        </div>
      )}

      {risks.length > 0 && (
        <>
          <section>
            <GlobeSection
              risks={globeRisks}
              fireballs={fireballs}
              updatedAt={updatedAt}
            />
          </section>

          {top && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Highest impact probability
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <ImpactCard event={top} rank={1} hero />
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
                  <p className="text-xs uppercase text-slate-500">At a glance</p>
                  <p className="mt-2 font-mono text-4xl font-bold text-amber-300">
                    {formatImpactPercent(top.ip)}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {top.fullname} leads the filtered list among{" "}
                    {filtered.length.toLocaleString()} objects (of{" "}
                    {risks.length.toLocaleString()} on Sentry).
                  </p>
                  <ul className="mt-4 space-y-1 text-xs text-slate-400">
                    <li>Year range: {top.range}</li>
                    <li>Virtual impactors: {top.n_imp}</li>
                    <li>Last observation: {top.last_obs}</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          <Filters minIp={minIp} onMinIpChange={setMinIp} />

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">
              Risk list ({filtered.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, 60).map((ev, i) => (
                <ImpactCard
                  key={ev.id || ev.des}
                  event={ev}
                  rank={i + 1}
                />
              ))}
            </div>
            {filtered.length > 60 && (
              <p className="mt-3 text-center text-xs text-slate-500">
                Showing top 60 of {filtered.length}. Raise min IP filter to
                focus.
              </p>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <FireballMap fireballs={fireballs} />
            <Timeline approaches={approaches} fireballs={fireballs} />
          </section>
        </>
      )}
    </div>
  );
}
