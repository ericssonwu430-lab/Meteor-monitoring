"use client";

import Link from "next/link";
import type { RiskEvent } from "@/types/neo";
import {
  formatDiameterKm,
  formatImpactPercent,
  formatPalermo,
  torinoColor,
} from "@/lib/format";

type Props = {
  event: RiskEvent;
  rank: number;
  hero?: boolean;
};

export default function ImpactCard({ event, rank, hero }: Props) {
  const ip = parseFloat(event.ip);
  const ts = event.ts_max ?? "0";

  return (
    <Link
      href={`/object/${encodeURIComponent(event.des)}`}
      className={`group block rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-lg shadow-black/40 transition hover:border-cyan-500/50 hover:bg-slate-900 ${
        hero ? "md:col-span-2 md:p-6" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">#{rank}</span>
            <h3
              className={`font-semibold text-slate-100 group-hover:text-cyan-300 ${
                hero ? "text-xl md:text-2xl" : "text-base"
              }`}
            >
              {event.fullname || event.des}
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Potential impacts {event.range} · {event.n_imp} VI
            {event.n_imp === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <div
            className={`font-mono font-bold text-amber-300 ${
              hero ? "text-3xl md:text-5xl" : "text-xl"
            }`}
          >
            {formatImpactPercent(ip)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            impact probability
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span
          className={`rounded px-2 py-0.5 font-semibold ${torinoColor(ts)}`}
        >
          Torino {ts ?? "0"}
        </span>
        <span className="rounded bg-indigo-900/80 px-2 py-0.5 text-indigo-200">
          Palermo {formatPalermo(event.ps_max)}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
          Ø {formatDiameterKm(event.diameter)}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
          H={event.h}
        </span>
      </div>
    </Link>
  );
}
