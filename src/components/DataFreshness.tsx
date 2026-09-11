"use client";

type Props = {
  updatedAt: Date | null;
  className?: string;
};

function formatAsOf(d: Date): string {
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day}, ${time}`;
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
        Auto-refreshes every 2 minutes from NASA/JPL Sentry, CAD, Fireball, and
        SBDB. Impact estimates can change when new observations arrive.
      </p>
    </div>
  );
}
