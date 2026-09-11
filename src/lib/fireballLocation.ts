import type { Fireball } from "@/types/neo";

/** Round coords for geocode cache keys (~1 km). */
export function coordCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/** Human-readable lat/lon, e.g. 34.1°N, 118.2°W */
export function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}°${ns}, ${Math.abs(lon).toFixed(1)}°${ew}`;
}

function wrapLon(lon: number): number {
  let L = lon;
  while (L > 180) L -= 360;
  while (L < -180) L += 360;
  return L;
}

/**
 * Rough ocean / polar basin from lat/lon boxes (IHO-inspired, educational).
 * Used when reverse-geocode has no country (typical over open ocean).
 */
export function oceanRegion(lat: number, lon: number): string {
  if (lat >= 66.5) return "Arctic Ocean";
  if (lat <= -60) return "Southern Ocean";

  const L = wrapLon(lon);

  // Enclosed / named seas — nicer than dumping them into an ocean basin
  if (lat > 30 && lat < 47 && L > -6 && L < 37) return "Mediterranean Sea";
  if (lat >= 40 && lat <= 48 && L >= 27 && L <= 42) return "Black Sea";
  if (lat >= 18 && lat <= 31 && L >= -98 && L <= -80) return "Gulf of Mexico";
  if (lat >= 8 && lat <= 23 && L >= -88 && L <= -59) return "Caribbean Sea";
  if (lat >= 10 && lat <= 30 && L >= 32 && L <= 44) return "Red Sea";

  // Indian Ocean: ~20°E–147°E, south of ~30°N (excluding far-east Pacific)
  if (L >= 20 && L < 147 && lat < 30) {
    // East of ~125°E near Indonesia/Philippines is Pacific
    if (L >= 125 && lat > -15) {
      return lat >= 0 ? "North Pacific Ocean" : "South Pacific Ocean";
    }
    return "Indian Ocean";
  }

  // Atlantic roughly 70°W–20°E
  if (L > -70 && L < 20) {
    return lat >= 0 ? "North Atlantic Ocean" : "South Atlantic Ocean";
  }

  return lat >= 0 ? "North Pacific Ocean" : "South Pacific Ocean";
}

/** Country name, or ocean/region fallback. */
export function placeName(
  lat: number,
  lon: number,
  country?: string | null
): string {
  const c = country?.trim();
  if (c) return c;
  return oceanRegion(lat, lon);
}

/** e.g. "Spotted near Chile" or "Spotted over North Pacific Ocean" */
export function spottedPhrase(
  lat: number,
  lon: number,
  country?: string | null
): string {
  const c = country?.trim();
  if (c) return `Spotted near ${c}`;
  return `Spotted over ${oceanRegion(lat, lon)}`;
}

export function attachFireballPlace(
  fireball: Fireball,
  country?: string | null
): Fireball {
  const c = (country ?? fireball.country ?? null)?.trim() || null;
  if (fireball.lat == null || fireball.lon == null) {
    return {
      ...fireball,
      country: c,
      location: fireball.location ?? null,
      spotted: fireball.spotted ?? null,
    };
  }
  const location = placeName(fireball.lat, fireball.lon, c);
  return {
    ...fireball,
    country: c,
    location,
    spotted: location,
  };
}
