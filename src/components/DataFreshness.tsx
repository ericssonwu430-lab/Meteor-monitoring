"use client";

import { LABELS } from "@/lib/labels";

type Props = {
  updatedAt: Date | null;
  className?: string;
};

function formatAsOf(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export default function DataFreshness({ updatedAt, className }: Props) {
  return (
    <div
      className={`rounded-xl border border-cyan-900/50 bg-slate-950/80 px-3 py-2.5 sm:px-4 ${className ?? ""}`}
    >
      <p className="text-sm font-medium text-slate-100">
        Data as of{" "}
        <span className="font-semibold text-cyan-300">
          {updatedAt ? formatAsOf(updatedAt) : "waiting for first fetch…"}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-slate-400">
        Auto-refreshes every 2 minutes from NASA/JPL{" "}
        {LABELS.sentry}, {LABELS.cad}, and {LABELS.fireballs}.{" "}
        {LABELS.sbdb} orbits load per selected object (~5 min cache).
        Impact estimates can change when new observations arrive.
      </p>
    </div>
  );
}
