/**
 * JPL Horizons observer ephemeris (geocentric, no visitor location).
 * https://ssd.jpl.nasa.gov/api/horizons.api
 */

import { constellationFromRaDec } from "@/lib/constellation";
import type { HorizonsEphemeris } from "@/types/neo";

export const AU_KM = 149597870.7;
export const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
export const HORIZONS_REVALIDATE = 1800; // 30 min

export class HorizonsResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HorizonsResolveError";
  }
}

function q(value: string): string {
  return `'${value}'`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Horizons calendar string in UTC: YYYY-MM-DD HH:MM */
export function formatHorizonsTime(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function sanitizeDes(raw: string): string {
  return raw.replace(/['"`]/g, "").replace(/[;\\]/g, "").trim();
}

function parseSexagesimal(raw: string): number | null {
  const s = raw.trim();
  if (!s || /^n\.?a\.?$/i.test(s)) return null;
  const m = s.match(
    /^([+-])?\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s+(\d+(?:\.\d+)?))?/
  );
  if (!m) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  const sign = m[1] === "-" ? -1 : 1;
  const a = parseFloat(m[2]);
  const b = parseFloat(m[3]);
  const c = m[4] != null ? parseFloat(m[4]) : 0;
  if (![a, b, c].every(Number.isFinite)) return null;
  return sign * (Math.abs(a) + b / 60 + c / 3600);
}

export function formatRaHms(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  const h = ((hours % 24) + 24) % 24;
  let hh = Math.floor(h + 1e-9);
  const m = (h - hh) * 60;
  let mm = Math.floor(m + 1e-9);
  let ss = Math.round((m - mm) * 60);
  if (ss === 60) {
    ss = 0;
    mm += 1;
  }
  if (mm === 60) {
    mm = 0;
    hh = (hh + 1) % 24;
  }
  return `${pad2(hh)}h ${pad2(mm)}m ${pad2(ss)}s`;
}

export function formatDecDms(deg: number): string {
  if (!Number.isFinite(deg)) return "—";
  const sign = deg >= 0 ? "+" : "-";
  const abs = Math.abs(deg);
  let dd = Math.floor(abs + 1e-9);
  const m = (abs - dd) * 60;
  let mm = Math.floor(m + 1e-9);
  let ss = Math.round((m - mm) * 60);
  if (ss === 60) {
    ss = 0;
    mm += 1;
  }
  if (mm === 60) {
    mm = 0;
    dd += 1;
  }
  return `${sign}${dd}° ${pad2(mm)}' ${pad2(ss)}"`;
}

export function formatRaShort(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  const h = ((hours % 24) + 24) % 24;
  const hh = Math.floor(h + 1e-9);
  const mm = Math.round((h - hh) * 60);
  if (mm === 60) return `${pad2((hh + 1) % 24)}h 00m`;
  return `${pad2(hh)}h ${pad2(mm)}m`;
}

export function formatDecShort(deg: number): string {
  if (!Number.isFinite(deg)) return "—";
  const sign = deg >= 0 ? "+" : "-";
  const abs = Math.abs(deg);
  const dd = Math.floor(abs + 1e-9);
  const mm = Math.round((abs - dd) * 60);
  if (mm === 60) return `${sign}${dd + 1}° 00′`;
  return `${sign}${dd}° ${pad2(mm)}′`;
}

function extractTargetName(result: string, des: string): string {
  const m = result.match(/Target body name:\s*(.+?)\s*\{/i);
  const raw = m?.[1]?.trim() ?? "";
  const named = raw.match(/^\d+\s+([A-Za-z][A-Za-z0-9' -]+?)\s*\(/);
  if (named?.[1]) return `NEO Asteroid ${named[1].trim()}`;
  const inParens = raw.match(/^\(([^)]+)\)$/);
  if (inParens?.[1]) return `NEO Asteroid ${inParens[1].trim()}`;
  if (raw && raw !== des) {
    const cleaned = raw.replace(/\s*\{.*$/, "").trim();
    if (cleaned) return `NEO Asteroid ${cleaned}`;
  }
  return `NEO Asteroid ${des}`;
}

function rowIsUnresolved(result: string): boolean {
  const u = result.toUpperCase();
  return (
    u.includes("NO MATCH") ||
    u.includes("NO SUCH RECORD") ||
    u.includes("CANNOT FIND") ||
    u.includes("UNKNOWN OBJECT") ||
    u.includes("NOT FOUND") ||
    (u.includes("MULTIPLE") && u.includes("MATCH")) ||
    u.includes("AMBIGUOUS") ||
    (!result.includes("$$SOE") &&
      (u.includes("NO UNIQUE") || u.includes("MATCHES")))
  );
}

type HorizonsJson = {
  result?: string;
  error?: string;
  signature?: { source?: string; version?: string };
};

export async function fetchHorizonsObserver(
  des: string,
  when = new Date()
): Promise<HorizonsEphemeris> {
  const clean = sanitizeDes(des);
  if (!clean) {
    throw new HorizonsResolveError("Missing designation");
  }

  const start = formatHorizonsTime(when);
  const stop = formatHorizonsTime(new Date(when.getTime() + 60 * 60 * 1000));

  const params = new URLSearchParams({
    format: "json",
    COMMAND: q(`DES=${clean};`),
    OBJ_DATA: q("YES"),
    MAKE_EPHEM: q("YES"),
    EPHEM_TYPE: q("OBSERVER"),
    CENTER: q("500@399"),
    START_TIME: q(start),
    STOP_TIME: q(stop),
    STEP_SIZE: q("1 d"),
    QUANTITIES: q("1,9,20"),
    ANG_FORMAT: q("HMS"),
    CSV_FORMAT: q("YES"),
  });

  const url = `${HORIZONS_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: HORIZONS_REVALIDATE },
  });
  if (!res.ok) {
    throw new Error(`JPL Horizons HTTP ${res.status}`);
  }
  const json = (await res.json()) as HorizonsJson;
  if (json.error) {
    const msg = String(json.error);
    if (rowIsUnresolved(msg) || /cannot|unknown|no such|no match/i.test(msg)) {
      throw new HorizonsResolveError(
        `Horizons could not resolve designation ${clean}`
      );
    }
    throw new Error(msg.replace(/\s+/g, " ").slice(0, 280));
  }
  const result = json.result ?? "";
  if (rowIsUnresolved(result) || !result.includes("$$SOE")) {
    throw new HorizonsResolveError(
      `Horizons could not resolve designation ${clean}`
    );
  }

  const block = result.split("$$SOE")[1]?.split("$$EOE")[0] ?? "";
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new HorizonsResolveError(
      `Horizons returned no ephemeris rows for ${clean}`
    );
  }

  const cols = lines[0].split(",").map((c) => c.trim());
  // Date, solar, lunar, RA, Dec, APmag, S-brt, delta, deldot
  const dateRaw = cols[0] ?? "";
  const raRaw = cols[3] ?? "";
  const decRaw = cols[4] ?? "";
  const magRaw = cols[5] ?? "";
  const deltaRaw = cols[7] ?? "";

  const raHours = parseSexagesimal(raRaw);
  const decDeg = parseSexagesimal(decRaw);
  const deltaAu = parseFloat(deltaRaw);
  const magN = parseFloat(magRaw);
  const magnitude = Number.isFinite(magN) ? magN : null;

  if (raHours == null || decDeg == null || !Number.isFinite(deltaAu)) {
    throw new HorizonsResolveError(
      `Horizons row for ${clean} was incomplete`
    );
  }

  const distanceKm = deltaAu * AU_KM;
  const hit = constellationFromRaDec(raHours, decDeg);
  const asOfDate = parseHorizonsDate(dateRaw) ?? when;

  return {
    des: clean,
    name: extractTargetName(result, clean),
    constellation: hit.name,
    constellationAbbr: hit.abbr,
    distanceKm,
    ra: formatRaHms(raHours),
    dec: formatDecDms(decDeg),
    raHours,
    decDeg,
    magnitude,
    asOf: asOfDate.toISOString(),
    source: "JPL Horizons",
    deltaAu,
  };
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseHorizonsDate(raw: string): Date | null {
  const s = raw.trim();
  const named = s.match(
    /^(\d{4})-([A-Za-z]{3})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (named) {
    const mo = MONTHS[named[2].toLowerCase()];
    if (mo == null) return null;
    return new Date(
      Date.UTC(
        parseInt(named[1], 10),
        mo,
        parseInt(named[3], 10),
        named[4] ? parseInt(named[4], 10) : 0,
        named[5] ? parseInt(named[5], 10) : 0,
        named[6] ? parseInt(named[6], 10) : 0
      )
    );
  }
  const iso = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (iso) {
    return new Date(
      Date.UTC(
        parseInt(iso[1], 10),
        parseInt(iso[2], 10) - 1,
        parseInt(iso[3], 10),
        iso[4] ? parseInt(iso[4], 10) : 0,
        iso[5] ? parseInt(iso[5], 10) : 0,
        iso[6] ? parseInt(iso[6], 10) : 0
      )
    );
  }
  return null;
}
