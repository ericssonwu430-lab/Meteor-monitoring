/** Deterministic near-Earth impact endpoint helpers shared by globe + timeline. */

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Lat/lon of the animated near-Earth path endpoint (illustrative, not NASA ground track). */
export function impactLatLonForDes(des: string, indexHint = 0): { lat: number; lon: number } {
  const seed = hashString(des || String(indexHint));
  const lat = seededUnit(seed, 1) * 140 - 70;
  const lon = seededUnit(seed, 2) * 360 - 180;
  return { lat, lon };
}
