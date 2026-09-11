import type { OrbitElements, RiskEvent, SentryDetailResponse } from "@/types/neo";

/** Format a Date as dd/mm/yy (en-GB / day-first, UTC). */
export function formatDdMmYy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/** Parse Sentry / SBDB date strings like "2880-03-16.99", "1950-02-23", "2026-09-11 17:00:24". */
export function parseLooseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

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
  const viDates = (detail?.data ?? [])
    .map((v) => parseLooseDate(v.date))
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());

  const firstObs =
    parseLooseDate(detail?.summary?.first_obs) ||
    parseLooseDate(orbit?.firstObs) ||
    parseLooseDate(risk.last_obs);

  const candidatesStart: Date[] = [];
  if (firstObs) candidatesStart.push(firstObs);
  if (viDates[0]) candidatesStart.push(viDates[0]);
  if (startYear != null) candidatesStart.push(new Date(Date.UTC(startYear, 0, 1)));

  const candidatesEnd: Date[] = [];
  if (viDates.length) candidatesEnd.push(viDates[viDates.length - 1]);
  if (endYear != null) candidatesEnd.push(new Date(Date.UTC(endYear, 11, 31)));
  if (startYear != null && endYear == null) {
    candidatesEnd.push(new Date(Date.UTC(startYear, 11, 31)));
  }

  const start =
    candidatesStart.length > 0
      ? candidatesStart.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b))
      : null;
  let end =
    candidatesEnd.length > 0
      ? candidatesEnd.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b))
      : null;

  if (start && end && end.getTime() < start.getTime()) {
    end = new Date(start.getTime());
  }

  return {
    start,
    end,
    labelStart: start ? formatDdMmYy(start) : "—",
    labelEnd: end ? formatDdMmYy(end) : "—",
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
