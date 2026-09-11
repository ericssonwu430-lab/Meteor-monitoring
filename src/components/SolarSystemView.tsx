"use client";

import { useMemo, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitElements, RiskEvent } from "@/types/neo";
import {
  EARTH_ORBIT,
  PLANET_ORBITS,
  compactOrbitElements,
  keplerPosition,
  sampleOrbitEllipse,
} from "@/lib/orbit";
import { formatImpactPercent } from "@/lib/format";
import { hashString } from "@/lib/meteorTrack";

/** Display units per AU — large enough that a close-up Earth (r≈1) does not collide with the Sun. */
export const AU_SCALE = 12;

function riskId(r: RiskEvent): string {
  return r.id || r.des;
}

function displayName(r: RiskEvent): string {
  const full = (r.fullname || "").trim();
  if (full && full !== r.des) return full;
  return r.des || r.id || "Unknown";
}

type KeplerEl = Pick<OrbitElements, "a" | "e" | "i" | "om" | "w" | "ma">;

/** Educational stand-in orbit when SBDB elements are missing. */
export function fallbackNeoOrbit(des: string): KeplerEl {
  const h = hashString(des || "neo");
  const a = 0.9 + (h % 80) / 100; // ~0.9–1.7 AU
  const e = 0.12 + (h % 45) / 100; // ~0.12–0.57
  return {
    a,
    e: Math.min(0.85, e),
    i: (h % 28),
    om: h % 360,
    w: (h * 7) % 360,
    ma: (h * 13) % 360,
  };
}

export function resolveOrbit(
  des: string,
  orbit?: OrbitElements | null
): { el: KeplerEl; approximate: boolean } {
  if (orbit?.available && orbit.a != null && orbit.e != null) {
    return {
      el: {
        a: orbit.a,
        e: orbit.e,
        i: orbit.i ?? 0,
        om: orbit.om ?? 0,
        w: orbit.w ?? 0,
        ma: orbit.ma ?? 0,
      },
      approximate: false,
    };
  }
  return { el: fallbackNeoOrbit(des), approximate: true };
}

function ScaledOrbitLine({
  el,
  color,
  opacity,
  lineWidth,
  dashed,
}: {
  el: KeplerEl;
  color: string;
  opacity: number;
  lineWidth: number;
  dashed?: boolean;
}) {
  const points = useMemo(() => {
    return sampleOrbitEllipse(el, 180).map((p) => p.multiplyScalar(AU_SCALE));
  }, [el]);

  if (opacity < 0.02) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      depthWrite={false}
      dashed={dashed}
      dashSize={dashed ? 0.35 : undefined}
      gapSize={dashed ? 0.25 : undefined}
    />
  );
}

function KeplerBody({
  el,
  progress,
  color,
  size,
  label,
  ipLabel,
  highlighted,
  opacity = 1,
  showLabel = true,
}: {
  el: KeplerEl;
  progress: number;
  color: string;
  size: number;
  label: string;
  ipLabel?: string;
  highlighted?: boolean;
  opacity?: number;
  showLabel?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!ref.current) return;
    keplerPosition(el, progress, pos);
    pos.multiplyScalar(AU_SCALE);
    ref.current.position.copy(pos);
    ref.current.visible = opacity > 0.02;
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[size * (highlighted ? 1.35 : 1), 16, 16]} />
        <meshBasicMaterial
          color={color}
          toneMapped={false}
          transparent={opacity < 0.99}
          opacity={opacity}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 2.2, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.22 * opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {showLabel && opacity > 0.35 && (
        <Html
          center
          distanceFactor={16}
          style={{ pointerEvents: "none" }}
          zIndexRange={[80, 0]}
        >
          <div
            className={`-translate-y-5 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px] shadow-lg backdrop-blur-sm ${
              highlighted
                ? "border-amber-400/80 bg-slate-950/90 text-amber-100"
                : "border-slate-600/60 bg-slate-950/70 text-slate-200"
            }`}
            style={{ opacity: Math.min(1, opacity * 1.2) }}
          >
            <span className="font-semibold text-cyan-200">{label}</span>
            {ipLabel && (
              <>
                <span className="mx-1 text-slate-500">·</span>
                <span className="font-bold text-amber-300">{ipLabel}</span>
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Bright arc from perihelion progress 0 → current for selected meteors. */
function TraceArc({
  el,
  progress,
  color,
  opacity,
  lineWidth,
}: {
  el: KeplerEl;
  progress: number;
  color: string;
  opacity: number;
  lineWidth: number;
}) {
  const points = useMemo(() => {
    const t = Math.min(1, Math.max(0.02, progress));
    const segs = Math.max(8, Math.ceil(t * 96));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const p = keplerPosition(el, (i / segs) * t, new THREE.Vector3());
      pts.push(p.multiplyScalar(AU_SCALE));
    }
    return pts;
  }, [el, progress]);

  if (opacity < 0.02 || points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      depthWrite={false}
    />
  );
}

type Props = {
  risks: RiskEvent[];
  selectedIds: string[];
  primaryId?: string | null;
  progress: number;
  orbits: Record<string, OrbitElements>;
  /** 0 = hidden (Earth close-up), 1 = fully visible (zoomed out) */
  fade?: number;
  /** When false, Earth marker is omitted (detailed Earth LOD handles it) */
  showEarthBody?: boolean;
  /** Keep solar system readable even if camera LOD fade is mid-blend (e.g. during Play) */
  forceVisible?: boolean;
};

export default function SolarSystemView({
  risks,
  selectedIds,
  primaryId,
  progress,
  orbits,
  fade = 1,
  showEarthBody = true,
  forceVisible = false,
}: Props) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRisks = useMemo(
    () => risks.filter((r) => selectedSet.has(riskId(r))),
    [risks, selectedSet]
  );

  const opacity = Math.min(
    1,
    Math.max(0, forceVisible ? Math.max(fade, 0.9) : fade)
  );
  if (opacity < 0.02) return null;

  return (
    <group>
      <ambientLight intensity={0.22 * opacity} />
      <pointLight
        position={[0, 0, 0]}
        intensity={4.2 * opacity}
        color="#fff7ed"
        distance={400}
        decay={1.6}
      />

      {/* Sun */}
      <group>
        <mesh>
          <sphereGeometry args={[0.55, 32, 32]} />
          <meshBasicMaterial
            color="#fbbf24"
            toneMapped={false}
            transparent={opacity < 0.99}
            opacity={opacity}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.95, 24, 24]} />
          <meshBasicMaterial
            color="#f59e0b"
            transparent
            opacity={0.28 * opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {opacity > 0.4 && (
          <Html center distanceFactor={24} style={{ pointerEvents: "none" }}>
            <div
              className="translate-y-8 whitespace-nowrap font-mono text-[11px] font-semibold text-amber-200/95"
              style={{ opacity }}
            >
              Sun
            </div>
          </Html>
        )}
      </group>

      {/* Major planets + orbit rings */}
      {PLANET_ORBITS.map((p) => {
        const el: KeplerEl = compactOrbitElements({
          a: p.a,
          e: p.e,
          i: p.i,
          om: p.om,
          w: p.w,
          ma: p.ma,
        });
        const isEarth = p.id === "earth";
        // Slightly oversized markers so all 8 planets read clearly
        const sizeBoost =
          p.id === "jupiter"
            ? 0.32
            : p.id === "saturn"
              ? 0.28
              : p.id === "uranus" || p.id === "neptune"
                ? 0.2
                : Math.max(0.11, p.size * 1.35);
        if (isEarth && !showEarthBody) {
          return (
            <ScaledOrbitLine
              key={p.id}
              el={el}
              color={p.color}
              opacity={0.7 * opacity}
              lineWidth={2.2}
            />
          );
        }
        return (
          <group key={p.id}>
            <ScaledOrbitLine
              el={el}
              color={p.color}
              opacity={(isEarth ? 0.7 : 0.5) * opacity}
              lineWidth={isEarth ? 2.2 : 1.6}
            />
            <KeplerBody
              el={el}
              progress={0}
              color={p.color}
              size={sizeBoost}
              label={p.name}
              opacity={opacity}
              showLabel={opacity > 0.25}
            />
          </group>
        );
      })}

      {/* Selected NEO heliocentric orbits + moving bodies */}
      {selectedRisks.map((r) => {
        const id = riskId(r);
        const resolved = resolveOrbit(r.des, orbits[r.des]);
        const el = compactOrbitElements(resolved.el);
        const approximate = resolved.approximate;
        const highlighted = id === primaryId;
        const orbitColor = highlighted ? "#fb923c" : "#94a3b8";
        const bodyColor = highlighted ? "#fdba74" : "#e2e8f0";
        return (
          <group key={id}>
            <ScaledOrbitLine
              el={el}
              color={orbitColor}
              opacity={(highlighted ? 1 : 0.65) * Math.max(opacity, 0.35)}
              lineWidth={highlighted ? 4.5 : 2.4}
              dashed={approximate}
            />
            <TraceArc
              el={el}
              progress={Math.max(progress, 0.02)}
              color={highlighted ? "#fbbf24" : "#cbd5e1"}
              opacity={(highlighted ? 1 : 0.75) * Math.max(opacity, 0.35)}
              lineWidth={highlighted ? 5.5 : 3}
            />
            <KeplerBody
              el={el}
              progress={progress}
              color={bodyColor}
              size={highlighted ? 0.18 : 0.1}
              label={
                approximate
                  ? `${displayName(r)} (approx.)`
                  : displayName(r)
              }
              ipLabel={formatImpactPercent(r.ip)}
              highlighted={highlighted}
              opacity={opacity}
            />
          </group>
        );
      })}
    </group>
  );
}

/** Earth heliocentric position in scene units (progress 0). */
export function earthHeliocentricPosition(
  out = new THREE.Vector3()
): THREE.Vector3 {
  keplerPosition(compactOrbitElements(EARTH_ORBIT), 0, out);
  return out.multiplyScalar(AU_SCALE);
}
