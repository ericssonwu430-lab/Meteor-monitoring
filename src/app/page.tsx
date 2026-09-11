"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GlobeSection from "@/components/GlobeSection";
import type { CloseApproach, Fireball, RiskEvent } from "@/types/neo";

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

  const asOf = updatedAt
    ? updatedAt.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="space-y-3">
      {/* Slim toolbar chip under app header */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">NEO monitor</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="text-xs text-slate-400">
            Data as of{" "}
            <span className="font-medium text-cyan-300">{asOf}</span>
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            if (risks.length === 0) setLoading(true);
            load();
          }}
          className="min-h-9 rounded-lg border border-slate-700 px-2.5 text-xs text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
        >
          Refresh
        </button>
      </div>

      {loading && risks.length === 0 && (
        <div className="mx-auto max-w-6xl rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center text-slate-400">
          Loading Sentry / CAD / Fireball / SBDB data…
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-6xl rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          Error: {error}
        </div>
      )}

      {risks.length > 0 && (
        <GlobeSection
          risks={globeRisks}
          listRisks={filtered}
          totalRiskCount={risks.length}
          fireballs={fireballs}
          approaches={approaches}
          updatedAt={updatedAt}
          minIp={minIp}
          onMinIpChange={setMinIp}
          onRefresh={load}
        />
      )}
    </div>
  );
}
