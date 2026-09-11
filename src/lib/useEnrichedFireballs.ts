"use client";

import { useEffect, useMemo, useState } from "react";
import type { Fireball } from "@/types/neo";
import {
  attachFireballPlace,
  coordCacheKey,
} from "@/lib/fireballLocation";

/** Module-level country cache — same idea as GlobeSection countryCache. */
const countryCache: Record<string, string | null> = {};
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let cacheEpoch = 0;

const GAP_MS = 400;

function remember(key: string, country: string | null) {
  countryCache[key] = country;
  cacheEpoch += 1;
  listeners.forEach((fn) => fn());
}

async function geocodeOne(lat: number, lon: number): Promise<string | null> {
  const res = await fetch(
    `/api/geocode?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`
  );
  const json = (await res.json()) as { country?: string | null };
  return typeof json.country === "string" && json.country.trim()
    ? json.country.trim()
    : null;
}

/**
 * Reverse-geocode unique fireball lat/lon via /api/geocode (throttled + cached).
 * Event coordinates only — never visitor GPS/IP.
 */
export function useEnrichedFireballs(fireballs: Fireball[]): Fireball[] {
  const [tick, setTick] = useState(cacheEpoch);

  useEffect(() => {
    const onChange = () => setTick(cacheEpoch);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const pendingKey = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const f of fireballs) {
      if (f.lat == null || f.lon == null) continue;
      const key = coordCacheKey(f.lat, f.lon);
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
    return keys.join("|");
  }, [fireballs]);

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;

    const jobs: { key: string; lat: number; lon: number }[] = [];
    const seen = new Set<string>();
    for (const f of fireballs) {
      if (f.lat == null || f.lon == null) continue;
      if (f.country) continue;
      const key = coordCacheKey(f.lat, f.lon);
      if (key in countryCache || inflight.has(key) || seen.has(key)) continue;
      seen.add(key);
      jobs.push({ key, lat: f.lat, lon: f.lon });
    }

    (async () => {
      for (const item of jobs) {
        if (cancelled) return;
        if (item.key in countryCache || inflight.has(item.key)) continue;
        inflight.add(item.key);
        try {
          remember(item.key, await geocodeOne(item.lat, item.lon));
        } catch {
          remember(item.key, null);
        } finally {
          inflight.delete(item.key);
        }
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  return useMemo(() => {
    void tick; // recompute when countryCache fills
    return fireballs.map((f) => {
      if (f.lat == null || f.lon == null) return attachFireballPlace(f);
      if (f.country) return attachFireballPlace(f, f.country);
      const key = coordCacheKey(f.lat, f.lon);
      const country = key in countryCache ? countryCache[key] : null;
      return attachFireballPlace(f, country);
    });
  }, [fireballs, tick]);
}
