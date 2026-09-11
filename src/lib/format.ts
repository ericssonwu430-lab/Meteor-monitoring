/** Impact probability as percent string. Tiny values use scientific notation. */
export function formatImpactPercent(ip: number | string): string {
  const n = typeof ip === "string" ? parseFloat(ip) : ip;
  if (!Number.isFinite(n) || n < 0) return "—";
  const pct = n * 100;
  if (pct === 0) return "0%";
  if (pct >= 0.01) {
    if (pct >= 1) return `${pct.toPrecision(4)}%`;
    return `${pct.toPrecision(3)}%`;
  }
  return `${pct.toExponential(2)}%`;
}

export function formatDiameterKm(d: string | number | null | undefined): string {
  if (d == null || d === "") return "—";
  const n = typeof d === "string" ? parseFloat(d) : d;
  if (!Number.isFinite(n)) return "—";
  if (n >= 1) return `${n.toPrecision(3)} km`;
  if (n >= 0.001) return `${(n * 1000).toPrecision(3)} m`;
  return `${(n * 1e6).toPrecision(3)} m`;
}

export function formatPalermo(ps: string | number | null | undefined): string {
  if (ps == null || ps === "") return "—";
  const n = typeof ps === "string" ? parseFloat(ps) : ps;
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export function formatAu(dist: string | number): string {
  const n = typeof dist === "string" ? parseFloat(dist) : dist;
  if (!Number.isFinite(n)) return "—";
  const ld = n / 0.002569; // ~LD
  return `${n.toFixed(4)} AU (~${ld.toFixed(1)} LD)`;
}

export function torinoColor(ts: string | number | null | undefined): string {
  const n =
    ts == null || ts === ""
      ? 0
      : typeof ts === "string"
        ? parseInt(ts, 10)
        : ts;
  if (n >= 8) return "bg-red-600 text-white";
  if (n >= 5) return "bg-orange-500 text-black";
  if (n >= 2) return "bg-yellow-400 text-black";
  if (n >= 1) return "bg-emerald-500 text-black";
  return "bg-slate-600 text-slate-200";
}
