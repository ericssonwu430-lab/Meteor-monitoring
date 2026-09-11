"use client";

import { useMemo, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitElements, RiskEvent } from "@/types/neo";
import { EARTH_ORBIT, keplerPosition, sampleOrbitEllipse } from "@/lib/orbit";
import { formatImpactPercent } from "@/lib/format";

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

function ScaledOrbitLine({
  el,
  color,
  opacity,
  lineWidth,
}: {
  el: Pick<OrbitElements, "a" | "e" | "i" | "om" | "w" | "ma">;
  color: string;
  opacity: number;
  lineWidth: number;
}) {
  const points = useMemo(() => {
    return sampleOrbitEllipse(el, 160).map((p) => p.multiplyScalar(AU_SCALE));
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
}: {
  el: Pick<OrbitElements, "a" | "e" | "i" | "om" | "w" | "ma">;
  progress: number;
  color: string;
  size: number;
  label: string;
  ipLabel?: string;
  highlighted?: boolean;
  opacity?: number;
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
      {opacity > 0.35 && (
        <Html
          center
          distanceFactor={14}
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
};

export default function SolarSystemView({
  risks,
  selectedIds,
  primaryId,
  progress,
  orbits,
  fade = 1,
  showEarthBody = true,
}: Props) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRisks = useMemo(
    () => risks.filter((r) => selectedSet.has(riskId(r))),
    [risks, selectedSet]
  );

  const opacity = Math.min(1, Math.max(0, fade));
  if (opacity < 0.02) return null;

  return (
    <group>
      <ambientLight intensity={0.18 * opacity} />
      <pointLight
        position={[0, 0, 0]}
        intensity={3.2 * opacity}
        color="#fff7ed"
        distance={120}
        decay={2}
      />
      {/* Sun */}
      <group>
        <mesh>
          <sphereGeometry args={[0.42, 32, 32]} />
          <meshBasicMaterial
            color="#fbbf24"
            toneMapped={false}
            transparent={opacity < 0.99}
            opacity={opacity}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.72, 24, 24]} />
          <meshBasicMaterial
            color="#f59e0b"
            transparent
            opacity={0.22 * opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {opacity > 0.4 && (
          <Html center distanceFactor={20} style={{ pointerEvents: "none" }}>
            <div
              className="translate-y-7 whitespace-nowrap font-mono text-[10px] text-amber-200/90"
              style={{ opacity }}
            >
              Sun
            </div>
          </Html>
        )}
      </group>

      <ScaledOrbitLine
        el={EARTH_ORBIT}
        color="#38bdf8"
        opacity={0.5 * opacity}
        lineWidth={1.6}
      />
      {showEarthBody && (
        <KeplerBody
          el={EARTH_ORBIT}
          progress={0}
          color="#38bdf8"
          size={0.14}
          label="Earth"
          opacity={opacity}
        />
      )}

      {selectedRisks.map((r) => {
        const orbit = orbits[r.des];
        if (!orbit?.available || orbit.a == null || orbit.e == null) return null;
        const id = riskId(r);
        const highlighted = id === primaryId;
        return (
          <group key={id}>
            <ScaledOrbitLine
              el={orbit}
              color={highlighted ? "#fb923c" : "#94a3b8"}
              opacity={(highlighted ? 0.9 : 0.45) * opacity}
              lineWidth={highlighted ? 2.4 : 1.2}
            />
            <KeplerBody
              el={orbit}
              progress={progress}
              color={highlighted ? "#fdba74" : "#e2e8f0"}
              size={highlighted ? 0.1 : 0.06}
              label={displayName(r)}
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
export function earthHeliocentricPosition(out = new THREE.Vector3()): THREE.Vector3 {
  keplerPosition(EARTH_ORBIT, 0, out);
  return out.multiplyScalar(AU_SCALE);
}
