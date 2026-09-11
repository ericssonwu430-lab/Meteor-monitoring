import { NextResponse } from "next/server";

export const revalidate = 86400;

type CacheEntry = { country: string | null; at: number };
const memoryCache = new Map<string, CacheEntry>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/** Reverse-geocode asteroid impact coordinates only — never visitor IP/location. */
async function reverseGeocode(
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
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        // Generic UA — do not embed personal emails/usernames
        "User-Agent": "MeteorMonitoringEducational/1.0 (public NEO dashboard)",
      },
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        address?: { country?: string };
      };
      const name = (json.address?.country || "").trim();
      if (name) return name;
    }
  } catch {
    /* ignore */
  }

  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "lat and lon required", country: null },
      { status: 400 }
    );
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: "lat/lon out of range", country: null },
      { status: 400 }
    );
  }

  const key = cacheKey(lat, lon);
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({
      country: hit.country,
      lat,
      lon,
      cached: true,
    });
  }

  const country = await reverseGeocode(lat, lon);
  memoryCache.set(key, { country, at: Date.now() });

  return NextResponse.json({ country, lat, lon, cached: false });
}
