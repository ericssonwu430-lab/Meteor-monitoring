"use client";

/**
 * Illustrative impact endpoint → country/ocean labels for MeteorPicker search.
 * Geocodes asteroid/event coords only — never visitor GPS/IP.
 */
import { useEffect, useMemo, useState } from "react";
import type { RiskEvent } from "@/types/neo";
import { impactLatLonForDes } from "@/lib/meteorTrack";
import { oceanRegion, placeName } from "@/lib/fireballLocation";

export type ImpactPlaceInfo = {
  country: string | null;
  location: string;
};

/** Shared lat/lon for globe ring, HUD geocode, and picker search. */
export function impactLocationForDes(
  des: string,
  indexHint = 0
): { lat: number; lon: number } {
  return impactLatLonForDes(des, indexHint);
}

/**
 * Client-safe label resolver: prefer geocoded country when available,
 * else oceanRegion(lat, lon) so ocean searches work offline immediately.
 */
export function resolveImpactPlace(
  lat: number,
  lon: number,
  country?: string | null
): ImpactPlaceInfo {
  const c = country?.trim() || null;
  return {
    country: c,
    location: placeName(lat, lon, c),
  };
}

/** Compact subtitle under a meteor name in the picker. */
export function impactNearPhrase(info: ImpactPlaceInfo): string {
  if (info.country) return `Illustrative end near ${info.country}`;
  // location is already an ocean/sea name when country is null
  const loc = info.location || oceanRegion(0, 0);
  return `Illustrative end over ${loc}`;
}

function riskId(r: RiskEvent): string {
  return r.id || r.des;
}

function seedKey(r: RiskEvent): string {
  return r.des || r.id || "";
}

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/** Module-level country cache — same idea as useEnrichedFireballs. */
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
  const json = (await res.json()) as {
    country?: string | null;
    location?: string | null;
  };
  return typeof json.country === "string" && json.country.trim()
    ? json.country.trim()
    : null;
}

/**
 * Map risk id → { country, location } for picker filter + subtitle.
 * Ocean labels available immediately; countries fill in via throttled /api/geocode.
 */
export function useImpactPlaces(
  risks: RiskEvent[]
): Map<string, ImpactPlaceInfo> {
  const [tick, setTick] = useState(cacheEpoch);

  useEffect(() => {
    const onChange = () => setTick(cacheEpoch);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const coords = useMemo(() => {
    return risks.map((r, i) => {
      const { lat, lon } = impactLocationForDes(seedKey(r), i);
      return { id: riskId(r), lat, lon, key: coordKey(lat, lon) };
    });
  }, [risks]);

  const pendingKey = useMemo(() => {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const c of coords) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      keys.push(c.key);
    }
    return keys.join("|");
  }, [coords]);

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;

    const jobs: { key: string; lat: number; lon: number }[] = [];
    const seen = new Set<string>();
    for (const c of coords) {
      if (c.key in countryCache || inflight.has(c.key) || seen.has(c.key)) {
        continue;
      }
      seen.add(c.key);
      jobs.push({ key: c.key, lat: c.lat, lon: c.lon });
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
    void tick;
    const map = new Map<string, ImpactPlaceInfo>();
    for (const c of coords) {
      const country =
        c.key in countryCache ? countryCache[c.key] : null;
      map.set(c.id, resolveImpactPlace(c.lat, c.lon, country));
    }
    return map;
  }, [coords, tick]);
}
