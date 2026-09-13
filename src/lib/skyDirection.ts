/**
 * Real-geometry sky direction from apparent RA/Dec.
 * Never invents a ground-track or impact country.
 */

export type EqUnit = { x: number; y: number; z: number };

/** Greenwich mean sidereal time (degrees) — IAU / Meeus approximation. */
export function gmstDegrees(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  return gmst;
}

/** ICRF equatorial unit vector: +X vernal equinox, +Z north celestial pole. */
export function raDecToEquatorialUnit(
  raHours: number,
  decDeg: number
): EqUnit {
  const ra = raHours * 15 * (Math.PI / 180);
  const dec = decDeg * (Math.PI / 180);
  const cosD = Math.cos(dec);
  return {
    x: cosD * Math.cos(ra),
    y: cosD * Math.sin(ra),
    z: Math.sin(dec),
  };
}

/**
 * Geographic point where the object is at the zenith at `date`.
 * lat ≈ declination; lon = RA − GMST. This is a sky direction, not an impact site.
 */
export function raDecToSubstellar(
  raHours: number,
  decDeg: number,
  date: Date
): { lat: number; lon: number } {
  const gmst = gmstDegrees(date);
  let lon = raHours * 15 - gmst;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const lat = Math.max(-90, Math.min(90, decDeg));
  return { lat, lon };
}
