/**
 * Reverse-geocode asteroid/fireball event coordinates only — never visitor IP/GPS.
 * Shared memory cache + Nominatim throttle for /api/geocode and /api/fireballs.
 * Country labels are requested in English so MeteorPicker search stays consistent.
 */
import { oceanRegion } from "@/lib/fireballLocation";

type CacheEntry = { country: string | null; at: number };

const memoryCache = new Map<string, CacheEntry>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Nominatim usage policy: max 1 request/second. */
const MIN_GAP_MS = 1100;

let lastNominatimAt = 0;
let nominatimChain: Promise<void> = Promise.resolve();
const inflightLookups = new Map<string, Promise<string | null>>();

/** Prefixed so pre-English cache entries are not reused after deploy. */
export function geocodeCacheKey(lat: number, lon: number): string {
  return `en:${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/** Cached country or `undefined` on miss. `null` means known "no country" (ocean). */
export function peekCountry(lat: number, lon: number): string | null | undefined {
  const hit = memoryCache.get(geocodeCacheKey(lat, lon));
  if (!hit) return undefined;
  if (Date.now() - hit.at >= TTL_MS) return undefined;
  return hit.country;
}

function remember(lat: number, lon: number, country: string | null) {
  memoryCache.set(geocodeCacheKey(lat, lon), { country, at: Date.now() });
}

/** Last comma-separated segment of display_name — often the country at low zoom. */
function countryFromDisplayName(displayName?: string): string | null {
  const raw = (displayName || "").trim();
  if (!raw) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  return last || null;
}

async function reverseGeocodeNominatim(
  lat: number,
  lon: number
): Promise<string | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("zoom", "3");
    url.searchParams.set("addressdetails", "1");
    // Force English country labels for impact-country search.
    url.searchParams.set("accept-language", "en");
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "MeteorMonitoringEducational/1.0 (public NEO dashboard)",
      },
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        address?: { country?: string };
        display_name?: string;
      };
      const fromAddress = (json.address?.country || "").trim();
      if (fromAddress) return fromAddress;
      return countryFromDisplayName(json.display_name);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function enqueueNominatim<T>(fn: () => Promise<T>): Promise<T> {
  const run = nominatimChain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastNominatimAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    return fn();
  });
  nominatimChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Country from cache or Nominatim (throttled, coalesced). Ocean points typically return null. */
export async function lookupCountry(
  lat: number,
  lon: number
): Promise<string | null> {
  const cached = peekCountry(lat, lon);
  if (cached !== undefined) return cached;
  const key = geocodeCacheKey(lat, lon);
  const existing = inflightLookups.get(key);
  if (existing) return existing;
  const pending = enqueueNominatim(() => reverseGeocodeNominatim(lat, lon))
    .then((country) => {
      remember(lat, lon, country);
      return country;
    })
    .finally(() => {
      inflightLookups.delete(key);
    });
  inflightLookups.set(key, pending);
  return pending;
}

export async function resolveLocation(
  lat: number,
  lon: number
): Promise<{ country: string | null; location: string; cached: boolean }> {
  const hit = peekCountry(lat, lon);
  if (hit !== undefined) {
    return {
      country: hit,
      location: hit || oceanRegion(lat, lon),
      cached: true,
    };
  }
  const country = await lookupCountry(lat, lon);
  return {
    country,
    location: country || oceanRegion(lat, lon),
    cached: false,
  };
}
