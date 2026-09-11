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
