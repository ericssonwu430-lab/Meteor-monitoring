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

export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "—";
  return km.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatDistanceKmCompact(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "—";
  const abs = Math.abs(km);
  if (abs >= 1e6) return `${(km / 1e6).toFixed(2)}M km`;
  if (abs >= 1e3) return `${(km / 1e3).toFixed(0)}k km`;
  return `${km.toFixed(0)} km`;
}

export function formatApparentMag(mag: number | null | undefined): string {
  if (mag == null || !Number.isFinite(mag)) return "—";
  return mag.toFixed(2);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatRaShort(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  const h = ((hours % 24) + 24) % 24;
  const hh = Math.floor(h + 1e-9);
  const mm = Math.round((h - hh) * 60);
  if (mm === 60) return `${pad2((hh + 1) % 24)}h 00m`;
  return `${pad2(hh)}h ${pad2(mm)}m`;
}

export function formatDecShort(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return "—";
  const sign = deg >= 0 ? "+" : "-";
  const abs = Math.abs(deg);
  const dd = Math.floor(abs + 1e-9);
  const mm = Math.round((abs - dd) * 60);
  if (mm === 60) return `${sign}${dd + 1}° 00′`;
  return `${sign}${dd}° ${pad2(mm)}′`;
}

/** High-precision AU like TheSkyLive (e.g. 0.0209967975). */
export function formatDeltaAu(au: number | null | undefined): string {
  if (au == null || !Number.isFinite(au)) return "—";
  if (Math.abs(au) >= 1) return au.toFixed(6);
  if (Math.abs(au) >= 0.01) return au.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
  return au.toFixed(10);
}

/** Light-travel time from range / c (seconds). */
export function formatLightTravel(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${seconds.toFixed(3)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${m}m ${s.toFixed(1)}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Relative age of an as-of timestamp for live badges. */
export function formatUpdatedAgo(asOfIso: string | null | undefined, nowMs = Date.now()): string {
  if (!asOfIso) return "—";
  const t = Date.parse(asOfIso);
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.round((nowMs - t) / 1000));
  if (sec < 1) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
