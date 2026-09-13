import type { OrbitElements, RiskEvent, SentryDetailResponse } from "@/types/neo";

const MONTH_INDEX: Record<string, number> = {
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

/** Format a Date as dd/mm/yyyy (en-GB / day-first, UTC). Optional HH:mm clock. */
export function formatDdMmYyyy(
  d: Date,
  opts?: { time?: boolean }
): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  const date = `${dd}/${mm}/${yyyy}`;
  if (!opts?.time) return date;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mi}`;
}

/** @deprecated Use formatDdMmYyyy — kept as an alias (now 4-digit year). */
export function formatDdMmYy(d: Date): string {
  return formatDdMmYyyy(d);
}

function hasClockTime(s: string): boolean {
  return /(?:[T ]\d{2}:\d{2})/.test(s);
}

/**
 * Parse NASA/Sentry/CAD/fireball strings to a Date and show dd/mm/yyyy,
 * keeping HH:mm when the source included a clock time.
 */
export function formatDisplayDate(raw: string | null | undefined): string {
  if (raw == null) return "—";
  const s = String(raw).trim();
  if (!s) return "—";
  const d = parseLooseDate(s);
  if (!d) return s;
  return formatDdMmYyyy(d, { time: hasClockTime(s) });
}

/** Parse Sentry / SBDB / CAD date strings like "2880-03-16.99", "1950-02-23", "2026-09-11 17:00:24", "2026-Sep-11 04:27". */
export function parseLooseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const named = s.match(
    /^(\d{4})-([A-Za-z]{3})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (named) {
    const mo = MONTH_INDEX[named[2].toLowerCase()];
    if (mo != null) {
      const y = parseInt(named[1], 10);
      const day = parseInt(named[3], 10);
      const h = named[4] != null ? parseInt(named[4], 10) : 0;
      const mi = named[5] != null ? parseInt(named[5], 10) : 0;
      const sec = named[6] != null ? parseInt(named[6], 10) : 0;
      const d = new Date(Date.UTC(y, mo, day, h, mi, sec));
      return Number.isFinite(d.getTime()) ? d : null;
    }
  }

  const withTime = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (withTime) {
    const y = parseInt(withTime[1], 10);
    const mo = parseInt(withTime[2], 10) - 1;
    const day = parseInt(withTime[3], 10);
    const h = withTime[4] != null ? parseInt(withTime[4], 10) : 0;
    const mi = withTime[5] != null ? parseInt(withTime[5], 10) : 0;
    const sec = withTime[6] != null ? parseInt(withTime[6], 10) : 0;
    const d = new Date(Date.UTC(y, mo, day, h, mi, sec));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const fractional = s.match(/^(\d{4})-(\d{2})-(\d{2}(?:\.\d+)?)/);
  if (fractional) {
    const y = parseInt(fractional[1], 10);
    const mo = parseInt(fractional[2], 10) - 1;
    const dayFloat = parseFloat(fractional[3]);
    const day = Math.floor(dayFloat);
    const frac = dayFloat - day;
    const ms = Math.round(frac * 86400000);
    const d = new Date(Date.UTC(y, mo, day, 0, 0, 0, ms));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) {
    return new Date(Date.UTC(parseInt(yearOnly[1], 10), 0, 1));
  }

  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function parseRangeYears(
  range: string | null | undefined
): { startYear: number | null; endYear: number | null } {
  if (!range) return { startYear: null, endYear: null };
  const m = range.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
  if (m) {
    return { startYear: parseInt(m[1], 10), endYear: parseInt(m[2], 10) };
  }
  const y = range.match(/(\d{4})/);
  if (y) {
    const n = parseInt(y[1], 10);
    return { startYear: n, endYear: n };
  }
  return { startYear: null, endYear: null };
}

export type TimelineDateBounds = {
  start: Date | null;
  end: Date | null;
  labelStart: string;
  labelEnd: string;
};

export function deriveTimelineDates(
  risk: RiskEvent | null,
  detail: SentryDetailResponse | null,
  orbit: OrbitElements | null | undefined
): TimelineDateBounds {
  const empty: TimelineDateBounds = {
    start: null,
    end: null,
    labelStart: "—",
    labelEnd: "—",
  };
  if (!risk) return empty;

  const { startYear, endYear } = parseRangeYears(risk.range);
  const viRaw = detail?.data ?? [];
  const viParsed = viRaw
    .map((v) => ({ raw: v.date, date: parseLooseDate(v.date) }))
    .filter((x): x is { raw: string; date: Date } => x.date != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // START = first observation (Sentry summary / SBDB); fall back only if missing.
  const firstObsRaw =
    detail?.summary?.first_obs || orbit?.firstObs || risk.last_obs || null;
  const firstObs = parseLooseDate(firstObsRaw);

  let start: Date | null = firstObs;
  let startRaw: string | null = firstObs ? firstObsRaw : null;
  if (!start && viParsed[0]) {
    start = viParsed[0].date;
    startRaw = viParsed[0].raw;
  }
  if (!start && startYear != null) {
    start = new Date(Date.UTC(startYear, 0, 1));
    startRaw = null;
  }

  // END = latest virtual-impactor date, else end of risk.range VI years.
  let end: Date | null = null;
  let endRaw: string | null = null;
  if (viParsed.length) {
    const last = viParsed[viParsed.length - 1];
    end = last.date;
    endRaw = last.raw;
  }
  if (!end && endYear != null) {
    end = new Date(Date.UTC(endYear, 11, 31));
    endRaw = null;
  }
  if (!end && startYear != null) {
    end = new Date(Date.UTC(startYear, 11, 31));
    endRaw = null;
  }

  if (start && end && end.getTime() < start.getTime()) {
    end = new Date(start.getTime());
    endRaw = startRaw;
  }

  return {
    start,
    end,
    labelStart: start
      ? formatDdMmYyyy(start, { time: !!(startRaw && hasClockTime(startRaw)) })
      : "—",
    labelEnd: end
      ? formatDdMmYyyy(end, { time: !!(endRaw && hasClockTime(endRaw)) })
      : "—",
  };
}

/** Linear interpolate between start and end by progress ∈ [0,1]. */
export function interpolateDate(
  start: Date | null,
  end: Date | null,
  progress: number
): Date | null {
  if (!start || !end) return start || end;
  const t = Math.min(1, Math.max(0, progress));
  const ms = start.getTime() + (end.getTime() - start.getTime()) * t;
  return new Date(ms);
}
