"use client";

import { useMemo, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitElements, RiskEvent } from "@/types/neo";
import { EARTH_ORBIT, keplerPosition, sampleOrbitEllipse } from "@/lib/orbit";
import { formatImpactPercent } from "@/lib/format";

export const AU_SCALE = 4;

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
    return sampleOrbitEllipse(el, 160).map((p) =>
      p.multiplyScalar(AU_SCALE)
    );
  }, [el]);

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
}: {
  el: Pick<OrbitElements, "a" | "e" | "i" | "om" | "w" | "ma">;
  progress: number;
  color: string;
  size: number;
  label: string;
  ipLabel?: string;
  highlighted?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!ref.current) return;
    keplerPosition(el, progress, pos);
    pos.multiplyScalar(AU_SCALE);
    ref.current.position.copy(pos);
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[size * (highlighted ? 1.35 : 1), 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 2.2, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
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
    </group>
  );
}

type Props = {
  risks: RiskEvent[];
  selectedIds: string[];
  primaryId?: string | null;
  progress: number;
  orbits: Record<string, OrbitElements>;
};

export default function SolarSystemView({
  risks,
  selectedIds,
  primaryId,
  progress,
  orbits,
}: Props) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRisks = useMemo(
    () => risks.filter((r) => selectedSet.has(riskId(r))),
    [risks, selectedSet]
  );

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <ambientLight intensity={0.18} />
      <pointLight position={[0, 0, 0]} intensity={3.2} color="#fff7ed" distance={80} decay={2} />
      {/* Sun */}
      <group>
        <mesh>
          <sphereGeometry args={[0.32, 32, 32]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.55, 24, 24]} />
          <meshBasicMaterial
            color="#f59e0b"
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <Html center distanceFactor={16} style={{ pointerEvents: "none" }}>
          <div className="translate-y-6 whitespace-nowrap font-mono text-[10px] text-amber-200/90">
            Sun
          </div>
        </Html>
      </group>

      <ScaledOrbitLine
        el={EARTH_ORBIT}
        color="#38bdf8"
        opacity={0.45}
        lineWidth={1.5}
      />
      <KeplerBody
        el={EARTH_ORBIT}
        progress={0}
        color="#38bdf8"
        size={0.11}
        label="Earth"
      />

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
              opacity={highlighted ? 0.85 : 0.4}
              lineWidth={highlighted ? 2.4 : 1.2}
            />
            <KeplerBody
              el={orbit}
              progress={progress}
              color={highlighted ? "#fdba74" : "#e2e8f0"}
              size={highlighted ? 0.09 : 0.055}
              label={displayName(r)}
              ipLabel={formatImpactPercent(r.ip)}
              highlighted={highlighted}
            />
          </group>
        );
      })}
    </>
  );
}
