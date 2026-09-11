"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { SentryDetailResponse, VirtualImpactor } from "@/types/neo";
import InfoTip from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";
import {
  formatDiameterKm,
  formatImpactPercent,
  formatPalermo,
  torinoColor,
} from "@/lib/format";

export default function ObjectDetailPage() {
  const params = useParams();
  const des = decodeURIComponent(String(params.des ?? ""));
  const [data, setData] = useState<SentryDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!des) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/sentry/${encodeURIComponent(des)}`);
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [des]);

  const summary = data?.summary;
  const vis: VirtualImpactor[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex text-sm text-cyan-400 hover:underline"
      >
        ← Back to dashboard
      </Link>

      {loading && (
        <p className="text-slate-400">Loading Sentry detail for {des}…</p>
      )}
      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </div>
      )}

      {summary && (
        <>
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-50 md:text-3xl">
              {summary.fullname || summary.des}
            </h1>
            <p className="text-sm text-slate-400">
              Designation <span className="font-mono text-slate-300">{summary.des}</span>
            </p>
            <div className="flex flex-wrap gap-2 pt-2 text-xs">
              <span
                className={`rounded px-2 py-0.5 font-semibold ${torinoColor(summary.ts_max)}`}
              >
                Torino {summary.ts_max ?? "0"} <InfoTip text={TIPS.torino} label="About Torino" />
              </span>
              <span className="rounded bg-indigo-900/80 px-2 py-0.5 text-indigo-200">
                Palermo max {formatPalermo(summary.ps_max)} · cum{" "}
                {formatPalermo(summary.ps_cum)}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5">
                Ø {formatDiameterKm(summary.diameter)}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5">
                H={summary.h}
              </span>
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="text-[10px] uppercase text-slate-500">
                Cumulative IP
              </p>
              <p className="mt-1 font-mono text-3xl font-bold text-amber-300">
                {formatImpactPercent(summary.ip)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="text-[10px] uppercase text-slate-500">
                Virtual impactors
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-100">
                {summary.n_imp}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="text-[10px] uppercase text-slate-500">
                Impact energy (Mt TNT)
              </p>
              <p className="mt-1 font-mono text-xl font-semibold text-slate-100">
                {summary.energy ?? "—"}
              </p>
            </div>
          </div>

          <dl className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-sm sm:grid-cols-2">
            {[
              ["v_inf (km/s)", summary.v_inf],
              ["v_imp (km/s)", summary.v_imp],
              ["Mass (kg)", summary.mass],
              ["First obs", summary.first_obs],
              ["Last obs", summary.last_obs],
              ["Observations", summary.nobs],
              ["Method", summary.method],
              ["Arc", summary.darc],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-2 border-b border-slate-800/80 py-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-mono text-slate-200">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">
              Virtual impactors
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2"><span className="inline-flex items-center gap-1">IP<InfoTip text={TIPS.impactProbability} label="About IP" /></span></th>
                    <th className="px-3 py-2"><span className="inline-flex items-center gap-1">Palermo<InfoTip text={TIPS.palermo} label="About Palermo" /></span></th>
                    <th className="px-3 py-2"><span className="inline-flex items-center gap-1">Torino<InfoTip text={TIPS.torino} label="About Torino" /></span></th>
                    <th className="px-3 py-2">Energy</th>
                    <th className="px-3 py-2">σ VI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {vis.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No virtual impactor rows
                      </td>
                    </tr>
                  )}
                  {vis.map((vi, i) => (
                    <tr key={`${vi.date}-${i}`} className="bg-slate-950/40">
                      <td className="px-3 py-2 font-mono text-slate-200">
                        {vi.date}
                      </td>
                      <td className="px-3 py-2 font-mono text-amber-300">
                        {formatImpactPercent(vi.ip)}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {formatPalermo(vi.ps)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${torinoColor(vi.ts)}`}
                        >
                          {vi.ts ?? "0"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-300">
                        {vi.energy}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">
                        {vi.sigma_vi}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
