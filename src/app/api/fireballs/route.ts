import { after } from "next/server";
import { NextResponse } from "next/server";
import { fetchFireballs, parseFireballRows } from "@/lib/nasa";
import { attachFireballPlace, coordCacheKey } from "@/lib/fireballLocation";
import { lookupCountry, peekCountry } from "@/lib/geocode";
import type { Fireball } from "@/types/neo";

export const revalidate = 120;

function uniqueCoords(fireballs: Fireball[]) {
  const unique: { lat: number; lon: number; key: string }[] = [];
  const seen = new Set<string>();
  for (const f of fireballs) {
    if (f.lat == null || f.lon == null) continue;
    const key = coordCacheKey(f.lat, f.lon);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ lat: f.lat, lon: f.lon, key });
  }
  return unique;
}

/**
 * Attach spotted place from memory cache + ocean/region fallback.
 * Never uses visitor GPS/IP. Nominatim runs after the response (and via /api/geocode).
 */
function enrichPlaces(fireballs: Fireball[]): Fireball[] {
  return fireballs.map((f) => {
    if (f.lat == null || f.lon == null) return attachFireballPlace(f);
    const cached = peekCountry(f.lat, f.lon);
    return attachFireballPlace(f, cached === undefined ? null : cached);
  });
}

export async function GET() {
  try {
    const raw = await fetchFireballs(50);
    const parsed = parseFireballRows(raw);
    const fireballs = enrichPlaces(parsed);

    const misses = uniqueCoords(parsed).filter(
      (u) => peekCountry(u.lat, u.lon) === undefined
    );
    if (misses.length > 0) {
      after(() => {
        // Warm cache in the background (throttled + coalesced with /api/geocode).
        return Promise.all(misses.map((u) => lookupCountry(u.lat, u.lon)));
      });
    }

    return NextResponse.json({
      signature: raw.signature,
      count: raw.count,
      fireballs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fireball fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
