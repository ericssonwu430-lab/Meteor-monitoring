"use client";

import Link from "next/link";
import type { RiskEvent } from "@/types/neo";
import InfoTip, { LabelWithInfo } from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";
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
  isNew?: boolean;
};

export default function ImpactCard({ event, rank, hero, isNew }: Props) {
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
              className={`inline-flex flex-wrap items-center gap-1.5 font-semibold text-slate-100 group-hover:text-cyan-300 ${
                hero ? "text-xl md:text-2xl" : "text-base"
              }`}
            >
              <span>{event.fullname || event.des}</span>
              <InfoTip text={TIPS.designation} label="About this name" />
              {isNew && (
                <span className="inline-flex items-center gap-1 rounded bg-lime-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-300 ring-1 ring-lime-400/40">
                  NEW
                  <InfoTip text={TIPS.newBadge} label="About NEW" />
                </span>
              )}
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
          <LabelWithInfo
            tip={TIPS.impactProbability}
            className="justify-end text-[10px] uppercase tracking-wide text-slate-500"
          >
            impact probability
          </LabelWithInfo>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${torinoColor(ts)}`}
        >
          Torino {ts ?? "0"}
          <InfoTip text={TIPS.torino} label="About Torino scale" />
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-indigo-900/80 px-2 py-0.5 text-indigo-200">
          Palermo {formatPalermo(event.ps_max)}
          <InfoTip text={TIPS.palermo} label="About Palermo scale" />
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-slate-300">
          Ø {formatDiameterKm(event.diameter)}
          <InfoTip text={TIPS.diameter} label="About diameter" />
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-slate-300">
          H={event.h}
          <InfoTip text={TIPS.absoluteMagnitude} label="About H magnitude" />
        </span>
      </div>
    </Link>
  );
}
