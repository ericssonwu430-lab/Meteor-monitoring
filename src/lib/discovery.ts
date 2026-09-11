import type { RiskEvent } from "@/types/neo";

/** How long a [NEW] badge stays after an object first appears post-baseline refresh. */
export const NEW_BADGE_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

const STORAGE_KEY = "meteor-monitoring:discovery-seen-v1";
const BASELINE_KEY = "meteor-monitoring:discovery-baseline-v1";

type SeenMap = Record<string, number>; // id -> firstSeenMs

function riskKey(r: RiskEvent): string {
  return r.id || r.des;
}

/** Extract discovery-ish year from designation / name (e.g. 2024 AB1). */
export function discoveryYear(r: RiskEvent): number | null {
  const text = `${r.des || ""} ${r.fullname || ""}`;
  const m = text.match(/\b((?:19|20)\d{2})\b/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return Number.isFinite(y) ? y : null;
}

/** Parse Sentry last_obs (YYYY-MM-DD or similar) to ms. */
export function lastObsMs(r: RiskEvent): number {
  const raw = (r.last_obs || "").trim();
  if (!raw) return 0;
  const t = Date.parse(raw.includes("T") ? raw : `${raw}T00:00:00Z`);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Sort key: newer discoveries first.
 * Prefer designation year (desc), then last observation (desc), then id.
 */
export function discoverySortKey(r: RiskEvent): [number, number, string] {
  const year = discoveryYear(r) ?? 0;
  const obs = lastObsMs(r);
  return [year, obs, riskKey(r)];
}

export function compareDiscoveryNewestFirst(a: RiskEvent, b: RiskEvent): number {
  const [ay, ao, ak] = discoverySortKey(a);
  const [by, bo, bk] = discoverySortKey(b);
  if (by !== ay) return by - ay;
  if (bo !== ao) return bo - ao;
  return ak.localeCompare(bk);
}

export function sortByDiscoveryNewestFirst(list: RiskEvent[]): RiskEvent[] {
  return [...list].sort(compareDiscoveryNewestFirst);
}

function readSeen(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SeenMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSeen(map: SeenMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode — ignore */
  }
}

function hasBaseline(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(BASELINE_KEY) === "1";
  } catch {
    return false;
  }
}

function setBaseline() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BASELINE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Update seen map after a successful Sentry load.
 * First successful load seeds the baseline (no [NEW] spam).
 * Later loads mark brand-new ids with firstSeen = now.
 * Prunes entries older than retention.
 * Returns the set of ids that should currently show [NEW].
 *
 * Uses only localStorage on this device (object ids + timestamps) — never sent to a server.
 */
export function syncNewDiscoveries(
  risks: RiskEvent[],
  now = Date.now()
): Set<string> {
  const ids = risks.map(riskKey).filter(Boolean);
  const seen = readSeen();

  // Drop expired NEW timestamps
  for (const [id, ts] of Object.entries(seen)) {
    if (now - ts > NEW_BADGE_RETENTION_MS) delete seen[id];
  }

  if (!hasBaseline()) {
    for (const id of ids) {
      // Known from first visit — no firstSeen stamp means not NEW
      if (seen[id] == null) {
        /* leave absent: absence after baseline means we need to distinguish
           "known without NEW" vs "never seen". Store 0 for known-not-new. */
        seen[id] = 0;
      }
    }
    writeSeen(seen);
    setBaseline();
    return new Set();
  }

  for (const id of ids) {
    if (seen[id] == null) {
      seen[id] = now; // brand new after refresh
    }
  }
  writeSeen(seen);

  const neu = new Set<string>();
  for (const id of ids) {
    const ts = seen[id] ?? 0;
    if (ts > 0 && now - ts <= NEW_BADGE_RETENTION_MS) {
      neu.add(id);
    }
  }
  return neu;
}

/** Retention label for UI copy. */
export function newBadgeRetentionLabel(): string {
  const h = Math.round(NEW_BADGE_RETENTION_MS / 3_600_000);
  return `${h}h`;
}
