import * as THREE from "three";
import type { OrbitElements } from "@/types/neo";

const DEG = Math.PI / 180;

/** Solve Kepler's equation M = E - e sin E (radians). */
export function solveKepler(M: number, e: number, iters = 12): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < iters; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

/** True anomaly from eccentric anomaly. */
export function trueAnomaly(E: number, e: number): number {
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const cosNu = (cosE - e) / (1 - e * cosE);
  const sinNu = (Math.sqrt(1 - e * e) * sinE) / (1 - e * cosE);
  return Math.atan2(sinNu, cosNu);
}

/**
 * Heliocentric ecliptic position (AU) from classic Keplerian elements.
 * Angles in degrees; a in AU. progress 0..1 maps mean anomaly offset.
 */
export function keplerPosition(
  el: Pick<OrbitElements, "a" | "e" | "i" | "om" | "w" | "ma">,
  progress: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const a = el.a ?? 1;
  const e = Math.min(0.99, Math.max(0, el.e ?? 0));
  const i = (el.i ?? 0) * DEG;
  const om = (el.om ?? 0) * DEG;
  const w = (el.w ?? 0) * DEG;
  const ma0 = (el.ma ?? 0) * DEG;
  const M = ma0 + progress * Math.PI * 2;
  const E = solveKepler(M, e);
  const nu = trueAnomaly(E, e);
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
  const x_orb = r * Math.cos(nu);
  const y_orb = r * Math.sin(nu);

  const cosOm = Math.cos(om);
  const sinOm = Math.sin(om);
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);

  const x =
    (cosOm * cosW - sinOm * sinW * cosI) * x_orb +
    (-cosOm * sinW - sinOm * cosW * cosI) * y_orb;
  const y =
    (sinOm * cosW + cosOm * sinW * cosI) * x_orb +
    (-sinOm * sinW + cosOm * cosW * cosI) * y_orb;
  const z = sinW * sinI * x_orb + cosW * sinI * y_orb;

  // Map ecliptic x,y,z → Three.js with y up: (x, z, -y)
  return out.set(x, z, -y);
}

/** Sample a closed Keplerian ellipse into Vector3 points (AU space). */
export function sampleOrbitEllipse(
  el: Pick<OrbitElements, "a" | "e" | "i" | "om" | "w" | "ma">,
  segments = 128
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    pts.push(keplerPosition(el, i / segments, new THREE.Vector3()));
  }
  return pts;
}

/** Earth's approximate circular orbit (1 AU). */
export const EARTH_ORBIT: Pick<
  OrbitElements,
  "a" | "e" | "i" | "om" | "w" | "ma"
> = {
  a: 1,
  e: 0.0167,
  i: 0,
  om: 0,
  w: 102.9,
  ma: 0,
};

/** Approximate mean Keplerian elements for major planets (educational). */
export type PlanetDef = {
  id: string;
  name: string;
  color: string;
  /** Visual body radius in scene units (not physical scale) */
  size: number;
  a: number;
  e: number;
  i: number;
  om: number;
  w: number;
  ma: number;
};

export const PLANET_ORBITS: PlanetDef[] = [
  { id: "mercury", name: "Mercury", color: "#a8a29e", size: 0.06, a: 0.387, e: 0.206, i: 7.0, om: 48.3, w: 29.1, ma: 174.8 },
  { id: "venus", name: "Venus", color: "#fbbf24", size: 0.09, a: 0.723, e: 0.007, i: 3.4, om: 76.7, w: 54.9, ma: 50.4 },
  { id: "earth", name: "Earth", color: "#38bdf8", size: 0.1, a: 1.0, e: 0.0167, i: 0.0, om: 0.0, w: 102.9, ma: 0.0 },
  { id: "mars", name: "Mars", color: "#f87171", size: 0.075, a: 1.524, e: 0.093, i: 1.9, om: 49.6, w: 286.5, ma: 19.4 },
  { id: "jupiter", name: "Jupiter", color: "#fdba74", size: 0.22, a: 5.203, e: 0.048, i: 1.3, om: 100.5, w: 273.9, ma: 20.0 },
  { id: "saturn", name: "Saturn", color: "#fde68a", size: 0.18, a: 9.537, e: 0.054, i: 2.5, om: 113.7, w: 339.4, ma: 317.0 },
  { id: "uranus", name: "Uranus", color: "#67e8f9", size: 0.14, a: 19.191, e: 0.047, i: 0.8, om: 74.0, w: 96.5, ma: 142.2 },
  { id: "neptune", name: "Neptune", color: "#60a5fa", size: 0.13, a: 30.07, e: 0.009, i: 1.8, om: 131.8, w: 273.2, ma: 256.2 },
];


/**
 * Compact educational scale so Mercury→Neptune fit in one frame.
 * Inner planets stay near-true; outer planets are log-compressed.
 */
export function compactSolarAu(aAu: number): number {
  const a = Math.max(0.05, aAu);
  if (a <= 1.6) return a; // Mercury–Mars roughly true
  if (a <= 5.5) return 1.6 + (a - 1.6) * 0.55; // toward Jupiter
  if (a <= 10) return 3.75 + (a - 5.5) * 0.35; // Saturn
  if (a <= 20) return 5.3 + (a - 10) * 0.22; // Uranus
  return 7.5 + (a - 20) * 0.12; // Neptune
}

/** Remap Kepler elements onto the compact solar display scale (semi-major only). */
export function compactOrbitElements<T extends { a: number | null | undefined }>(
  el: T
): T {
  const a = el.a ?? 1;
  return { ...el, a: compactSolarAu(a) };
}
