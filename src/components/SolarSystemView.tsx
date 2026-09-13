"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitElements, RiskEvent } from "@/types/neo";
import {
  EARTH_ORBIT,
  PLANET_EPOCH,
  PLANET_ORBITS,
  compactOrbitElements,
  keplerPositionFromMeanAnomaly,
  meanAnomalyArcBetweenDates,
  meanAnomalyDegreesAt,
  resolveEpochDate,
  sampleOrbitEllipse,
} from "@/lib/orbit";
import { interpolateDate } from "@/lib/timelineDates";
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

type KeplerEl = Pick<OrbitElements, "a" | "e" | "i" | "om" | "w" | "ma"> & {
  epoch?: string | null;
};

/** Educational stand-in orbit when SBDB elements are missing. */
export function fallbackNeoOrbit(des: string): KeplerEl {
  const h = hashString(des || "neo");
  const a = 0.9 + (h % 80) / 100; // ~0.9–1.7 AU
  const e = 0.12 + (h % 45) / 100; // ~0.12–0.57
  return {
    a,
    e: Math.min(0.85, e),
    i: h % 28,
    om: h % 360,
    w: (h * 7) % 360,
    ma: (h * 13) % 360,
    epoch: null,
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
        epoch: orbit.epoch ?? null,
      },
      approximate: false,
    };
  }
  return { el: fallbackNeoOrbit(des), approximate: true };
}

/** Scrubbed calendar date from timeline + live progressRef (smooth during Play). */
function scrubbedAtDate(
  timelineStart: Date | null | undefined,
  timelineEnd: Date | null | undefined,
  progress: number,
  progressRef?: MutableRefObject<number>
): Date | null {
  const t =
    progressRef && typeof progressRef.current === "number"
      ? progressRef.current
      : progress;
  return interpolateDate(
    timelineStart ?? null,
    timelineEnd ?? null,
    Math.min(1, Math.max(0, t))
  );
}

/**
 * Display position: mean anomaly from true-a + epoch; radius on compact scale.
 */
function keplerDisplayAtDate(
  trueEl: KeplerEl,
  atDate: Date | null,
  out: THREE.Vector3,
  epochOverride?: Date | null
): THREE.Vector3 {
  const displayEl = compactOrbitElements(trueEl);
  const epochDate = resolveEpochDate(trueEl, epochOverride);
  if (epochDate && atDate && Number.isFinite(atDate.getTime())) {
    const M = meanAnomalyDegreesAt(trueEl, epochDate, atDate);
    return keplerPositionFromMeanAnomaly(displayEl, M, out);
  }
  return keplerPositionFromMeanAnomaly(displayEl, trueEl.ma ?? 0, out);
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
    const displayEl = compactOrbitElements(el);
    return sampleOrbitEllipse(displayEl, 180).map((p) =>
      p.multiplyScalar(AU_SCALE)
    );
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
  progressRef,
  timelineStart,
  timelineEnd,
  epochOverride,
  color,
  size,
  label,
  ipLabel,
  highlighted,
  opacity = 1,
  showLabel = true,
  /**
   * When true (planets): omit distanceFactor so label stays fixed screen size,
   * matching app title typography. NEOs keep default distance-scaled labels.
   */
  constantLabel = false,
}: {
  el: KeplerEl;
  progress: number;
  progressRef?: MutableRefObject<number>;
  timelineStart?: Date | null;
  timelineEnd?: Date | null;
  epochOverride?: Date | null;
  color: string;
  size: number;
  label: string;
  ipLabel?: string;
  highlighted?: boolean;
  opacity?: number;
  showLabel?: boolean;
  /** Fixed CSS size at all zooms (no distanceFactor); planets/Sun only */
  constantLabel?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!ref.current) return;
    const at = scrubbedAtDate(
      timelineStart,
      timelineEnd,
      progress,
      progressRef
    );
    keplerDisplayAtDate(el, at, pos, epochOverride);
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
          {...(constantLabel ? {} : { distanceFactor: 16 })}
          style={{ pointerEvents: "none" }}
          zIndexRange={[80, 0]}
        >
          <div
            className={`-translate-y-5 whitespace-nowrap rounded-md border shadow-lg backdrop-blur-sm ${
              constantLabel
                ? "px-2 py-0.5 font-semibold tracking-tight text-base text-slate-100 border-slate-600/50 bg-slate-950/70"
                : highlighted
                  ? "px-1.5 py-0.5 font-mono text-[10px] border-amber-400/80 bg-slate-950/90 text-amber-100"
                  : "px-1.5 py-0.5 font-mono text-[10px] border-slate-600/60 bg-slate-950/70 text-slate-200"
            }`}
            style={{ opacity: Math.min(1, opacity * 1.2) }}
          >
            <span
              className={
                constantLabel
                  ? "font-semibold tracking-tight text-slate-100"
                  : "font-semibold text-cyan-200"
              }
            >
              {label}
            </span>
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

/** Bright arc along the orbit from timeline start (or epoch) → scrubbed date. */
function TraceArc({
  el,
  progress,
  progressRef,
  timelineStart,
  timelineEnd,
  epochOverride,
  color,
  opacity,
  lineWidth,
}: {
  el: KeplerEl;
  progress: number;
  progressRef?: MutableRefObject<number>;
  timelineStart?: Date | null;
  timelineEnd?: Date | null;
  epochOverride?: Date | null;
  color: string;
  opacity: number;
  lineWidth: number;
}) {
  // Seed with a tiny segment so <Line> always has ≥2 points
  const [points, setPoints] = useState<THREE.Vector3[]>(() => [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.01, 0, 0),
  ]);
  const lastT = useRef(-1);

  useFrame(() => {
    const t =
      progressRef && typeof progressRef.current === "number"
        ? progressRef.current
        : progress;
    const clamped = Math.min(1, Math.max(0, t));
    // Rebuild when scrub/play moves (or el/timeline identity changes via lastT reset below)
    if (Math.abs(clamped - lastT.current) < 0.0015) return;
    lastT.current = clamped;

    const at = interpolateDate(
      timelineStart ?? null,
      timelineEnd ?? null,
      clamped
    );
    const { maStart, deltaFrac } = meanAnomalyArcBetweenDates(
      el,
      timelineStart,
      at,
      epochOverride
    );
    const frac = Math.min(1, Math.max(0.02, deltaFrac > 0 ? deltaFrac : 0.02));
    const segs = Math.max(8, Math.ceil(frac * 96));
    const displayEl = compactOrbitElements(el);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const M = maStart + (i / segs) * frac * 360;
      const p = keplerPositionFromMeanAnomaly(
        displayEl,
        M,
        new THREE.Vector3()
      );
      pts.push(p.multiplyScalar(AU_SCALE));
    }
    setPoints(pts);
  });

  // Force rebuild when orbit/timeline inputs change (primitive deps — el is a fresh object each render)
  useEffect(() => {
    lastT.current = -1;
  }, [
    el.a,
    el.e,
    el.i,
    el.om,
    el.w,
    el.ma,
    el.epoch,
    timelineStart,
    timelineEnd,
    epochOverride,
  ]);

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
  progressRef?: MutableRefObject<number>;
  /** First observation (timeline bar start). */
  timelineStart?: Date | null;
  /** Potential impact (timeline bar end). */
  timelineEnd?: Date | null;
  orbits: Record<string, OrbitElements>;
  /** 0 = hidden (Earth close-up), 1 = fully visible (zoomed out) */
  fade?: number;
  /** When false, Earth marker is omitted (detailed Earth LOD handles it) */
  showEarthBody?: boolean;
  /** Keep solar system readable even if camera LOD fade is mid-blend (e.g. during Play) */
  forceVisible?: boolean;
  /** When false, hide Mercury–Neptune bodies/rings (Sun + meteor orbit paths stay) */
  showPlanets?: boolean;
};

export default function SolarSystemView({
  risks,
  selectedIds,
  primaryId,
  progress,
  progressRef,
  timelineStart = null,
  timelineEnd = null,
  orbits,
  fade = 1,
  showEarthBody = true,
  forceVisible = false,
  showPlanets = true,
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
          <Html center style={{ pointerEvents: "none" }}>
            <div
              className="translate-y-8 whitespace-nowrap rounded-md border border-amber-500/40 bg-slate-950/60 px-2 py-0.5 font-semibold tracking-tight text-base text-slate-100 shadow-lg backdrop-blur-sm"
              style={{ opacity }}
            >
              Sun
            </div>
          </Html>
        )}
      </group>

      {/* Major planet orbit rings + fixed bodies.
          Rings always shown when showPlanets; bodies stay at progress=0 (no time-bar scrub).
          Only the meteor heliocentric ellipse + TraceArc follow the time bar. */}
      {showPlanets &&
        PLANET_ORBITS.map((p) => {
          const el: KeplerEl = {
            a: p.a,
            e: p.e,
            i: p.i,
            om: p.om,
            w: p.w,
            ma: p.ma,
            epoch: null,
          };
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
          // Detailed Earth LOD owns the globe; keep Earth orbit ring only.
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
                showLabel={opacity > 0.65}
                constantLabel
              />
            </group>
          );
        })}

      {/* Selected NEO heliocentric orbits + moving bodies */}
      {selectedRisks.map((r) => {
        const id = riskId(r);
        const resolved = resolveOrbit(r.des, orbits[r.des]);
        const el = resolved.el;
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
              progress={progress}
              progressRef={progressRef}
              timelineStart={timelineStart}
              timelineEnd={timelineEnd}
              color={highlighted ? "#fbbf24" : "#cbd5e1"}
              opacity={(highlighted ? 1 : 0.75) * Math.max(opacity, 0.35)}
              lineWidth={highlighted ? 5.5 : 3}
            />
            <KeplerBody
              el={el}
              progress={progress}
              progressRef={progressRef}
              timelineStart={timelineStart}
              timelineEnd={timelineEnd}
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
              showLabel={opacity > 0.4}
            />
          </group>
        );
      })}
    </group>
  );
}

/**
 * Earth heliocentric position in scene units at optional calendar date
 * (educational Kepler from J2000 mean elements).
 */
export function earthHeliocentricPosition(
  out = new THREE.Vector3(),
  atDate?: Date | null
): THREE.Vector3 {
  keplerDisplayAtDate(
    { ...EARTH_ORBIT, epoch: null },
    atDate ?? null,
    out,
    PLANET_EPOCH
  );
  return out.multiplyScalar(AU_SCALE);
}
