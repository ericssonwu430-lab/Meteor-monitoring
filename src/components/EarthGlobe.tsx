"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Html,
  Line,
  OrbitControls,
  Sphere,
  Stars,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Fireball, OrbitElements, RiskEvent } from "@/types/neo";
import { formatImpactPercent } from "@/lib/format";
import { hashString, seededUnit } from "@/lib/meteorTrack";
import SolarSystemView, {
  earthHeliocentricPosition,
} from "@/components/SolarSystemView";

const EARTH_RADIUS = 1;
const MAX_METEORS = 22;
const MAX_FIREBALLS = 40;
const TRAIL_SEGMENTS = 28;
const SPARK_COUNT = 8;

/** Camera distance from Earth: fully near-Earth LOD below NEAR, fully solar above FAR. */
const LOD_NEAR = 5.5;
const LOD_FAR = 16;

const EARTH_DIFFUSE =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg";
const EARTH_SPECULAR =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_specular_2048.jpg";
const EARTH_CLOUDS =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png";

export type LodMode = "earth" | "solar" | "blend";

type Props = {
  risks: RiskEvent[];
  fireballs: Fireball[];
  /** When false, hide fireball flashes on the globe */
  showFireballs?: boolean;
  /** Best-effort impact country for the primary meteor (shown on Earth) */
  impactCountry?: string | null;
  impactCountryReady?: boolean;
  selectedIds?: string[];
  primaryId?: string | null;
  className?: string;
  progress?: number;
  playing?: boolean;
  orbits?: Record<string, OrbitElements>;
  orbitsLoading?: boolean;
  /** Fires when continuous-zoom LOD changes */
  onLodChange?: (info: { blend: number; distance: number; mode: LodMode }) => void;
};

type MeteorTrack = {
  id: string;
  des: string;
  label: string;
  ip: number;
  ipLabel: string;
  lat: number;
  lon: number;
  start: THREE.Vector3;
  mid: THREE.Vector3;
  end: THREE.Vector3;
  speed: number;
  size: number;
  phase: number;
};

class TextureErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}


function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function displayName(r: RiskEvent): string {
  const full = (r.fullname || "").trim();
  if (full && full !== r.des) return full;
  return r.des || r.id || "Unknown";
}

function buildTracks(risks: RiskEvent[]): MeteorTrack[] {
  return risks.slice(0, MAX_METEORS).map((r, i) => {
    const ip = parseFloat(r.ip) || 0;
    const seed = hashString(r.des || r.id || String(i));
    const lat = seededUnit(seed, 1) * 140 - 70;
    const lon = seededUnit(seed, 2) * 360 - 180;
    const end = latLonToVec3(lat, lon, EARTH_RADIUS * 1.01);
    const approachDir = end.clone().normalize();
    const tangent = new THREE.Vector3(
      seededUnit(seed, 3) - 0.5,
      seededUnit(seed, 4) - 0.5,
      seededUnit(seed, 5) - 0.5
    )
      .normalize()
      .cross(approachDir)
      .normalize();
    const startDist = 2.4 + seededUnit(seed, 6) * 1.4;
    const start = approachDir
      .clone()
      .multiplyScalar(startDist)
      .add(tangent.clone().multiplyScalar(0.6 + seededUnit(seed, 7) * 1.2));
    const mid = start
      .clone()
      .lerp(end, 0.45)
      .add(tangent.clone().multiplyScalar(0.35))
      .add(approachDir.clone().multiplyScalar(0.15));
    const size = 0.022 + Math.min(0.055, Math.log10(ip * 1e6 + 1) * 0.014);
    const speed = 0.14 + Math.min(0.4, ip * 45) + seededUnit(seed, 8) * 0.1;
    return {
      id: r.id || r.des,
      des: r.des,
      label: displayName(r),
      ip,
      ipLabel: formatImpactPercent(ip),
      lat,
      lon,
      start,
      mid,
      end,
      speed,
      size,
      phase: seededUnit(seed, 9),
    };
  });
}

function bezierPoint(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  t: number,
  out: THREE.Vector3
) {
  const u = 1 - t;
  out.set(0, 0, 0);
  out.addScaledVector(a, u * u);
  out.addScaledVector(b, 2 * u * t);
  out.addScaledVector(c, t * t);
  return out;
}

function bezierTangent(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  t: number,
  out: THREE.Vector3
) {
  out.set(0, 0, 0);
  out.addScaledVector(a, 2 * (t - 1));
  out.addScaledVector(b, 2 - 4 * t);
  out.addScaledVector(c, 2 * t);
  return out.normalize();
}

function sampleBezier(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  n = 56
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    bezierPoint(a, b, c, i / n, tmp);
    pts.push(tmp.clone());
  }
  return pts;
}

function TrajectoryRibbon({
  track,
  progress,
  highlighted,
  opacity,
}: {
  track: MeteorTrack;
  progress: number;
  highlighted: boolean;
  opacity: number;
}) {
  const fullPts = useMemo(
    () => sampleBezier(track.start, track.mid, track.end, 56),
    [track]
  );
  const traveled = useMemo(() => {
    const t = Math.min(1, Math.max(0, progress));
    const n = Math.max(2, Math.floor(t * (fullPts.length - 1)) + 1);
    return fullPts.slice(0, n);
  }, [fullPts, progress]);

  const tube = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(fullPts);
    return new THREE.TubeGeometry(
      curve,
      48,
      highlighted ? 0.016 : 0.01,
      6,
      false
    );
  }, [fullPts, highlighted]);

  useEffect(() => () => tube.dispose(), [tube]);

  if (opacity < 0.04) return null;

  return (
    <group>
      <mesh geometry={tube}>
        <meshBasicMaterial
          color={highlighted ? "#fb923c" : "#64748b"}
          transparent
          opacity={(highlighted ? 0.38 : 0.22) * opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line
        points={traveled}
        color={highlighted ? "#fdba74" : "#94a3b8"}
        lineWidth={highlighted ? 2.6 : 1.6}
        transparent
        opacity={0.95 * opacity}
        depthWrite={false}
      />
    </group>
  );
}

function ImpactMark({
  end,
  highlighted,
  opacity,
  countryLabel,
}: {
  end: THREE.Vector3;
  highlighted: boolean;
  opacity: number;
  /** Shown on Earth at the impact point for the primary meteor */
  countryLabel?: string | null;
}) {
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), end.clone().normalize());
    return q;
  }, [end]);
  if (opacity < 0.04) return null;
  const label =
    countryLabel === undefined
      ? null
      : countryLabel
        ? countryLabel
        : "Undetermined";
  return (
    <group position={end}>
      <mesh quaternion={quat}>
        <ringGeometry
          args={highlighted ? [0.028, 0.048, 24] : [0.02, 0.034, 20]}
        />
        <meshBasicMaterial
          color={highlighted ? "#f87171" : "#fb923c"}
          transparent
          opacity={(highlighted ? 0.85 : 0.45) * opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {highlighted && label && (
        <Html
          center
          distanceFactor={6}
          style={{ pointerEvents: "none", opacity }}
          zIndexRange={[80, 0]}
        >
          <div className="whitespace-nowrap rounded-md border border-amber-500/50 bg-slate-950/90 px-2 py-1 text-center shadow-lg shadow-black/50">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-200/90">
              Potential impact
            </p>
            <p className="text-xs font-semibold text-amber-100">{label}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

function useEarthSpin(autoRotate: boolean) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!autoRotate) return;
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.04;
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.055;
  });
  return { earthRef, cloudRef };
}

function Atmosphere({ opacity = 1 }: { opacity?: number }) {
  return (
    <Sphere args={[EARTH_RADIUS * 1.045, 32, 32]}>
      <meshBasicMaterial
        color="#38bdf8"
        transparent
        opacity={0.08 * opacity}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </Sphere>
  );
}

function TexturedEarth({
  autoRotate,
  opacity,
}: {
  autoRotate: boolean;
  opacity: number;
}) {
  const { earthRef, cloudRef } = useEarthSpin(autoRotate);
  const [map, spec, clouds] = useTexture(
    [EARTH_DIFFUSE, EARTH_SPECULAR, EARTH_CLOUDS],
    (loaded) => {
      const list = Array.isArray(loaded) ? loaded : [loaded];
      list.forEach((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
      });
    }
  );

  return (
    <group visible={opacity > 0.02}>
      <Sphere ref={earthRef} args={[EARTH_RADIUS, 64, 64]}>
        <meshPhongMaterial
          map={map}
          specularMap={spec}
          specular={new THREE.Color("#335566")}
          shininess={12}
          transparent={opacity < 0.98}
          opacity={opacity}
        />
      </Sphere>
      <Sphere ref={cloudRef} args={[EARTH_RADIUS * 1.015, 48, 48]}>
        <meshPhongMaterial
          map={clouds}
          transparent
          opacity={0.35 * opacity}
          depthWrite={false}
        />
      </Sphere>
      <Atmosphere opacity={opacity} />
    </group>
  );
}

function ProceduralEarth({
  autoRotate,
  opacity,
}: {
  autoRotate: boolean;
  opacity: number;
}) {
  const { earthRef, cloudRef } = useEarthSpin(autoRotate);
  return (
    <group visible={opacity > 0.02}>
      <Sphere ref={earthRef} args={[EARTH_RADIUS, 64, 64]}>
        <meshPhongMaterial
          color="#1d4f8c"
          emissive="#0a1f33"
          specular="#4a90a4"
          shininess={18}
          transparent={opacity < 0.98}
          opacity={opacity}
        />
      </Sphere>
      <Sphere args={[EARTH_RADIUS * 1.002, 48, 48]}>
        <meshBasicMaterial
          color="#1a7a4c"
          transparent
          opacity={0.28 * opacity}
          depthWrite={false}
        />
      </Sphere>
      <Sphere ref={cloudRef} args={[EARTH_RADIUS * 1.015, 48, 48]}>
        <meshPhongMaterial
          color="#e2e8f0"
          transparent
          opacity={0.1 * opacity}
          depthWrite={false}
        />
      </Sphere>
      <Atmosphere opacity={opacity} />
    </group>
  );
}

function EarthWithFallback({
  autoRotate,
  opacity,
}: {
  autoRotate: boolean;
  opacity: number;
}) {
  return (
    <TextureErrorBoundary
      fallback={<ProceduralEarth autoRotate={autoRotate} opacity={opacity} />}
    >
      <Suspense
        fallback={<ProceduralEarth autoRotate={autoRotate} opacity={opacity} />}
      >
        <TexturedEarth autoRotate={autoRotate} opacity={opacity} />
      </Suspense>
    </TextureErrorBoundary>
  );
}

function Meteor({
  track,
  progress,
  highlighted,
  opacity,
}: {
  track: MeteorTrack;
  progress: number;
  highlighted: boolean;
  opacity: number;
}) {
  const headRef = useRef<THREE.Group>(null);
  const coreTrailRef = useRef<THREE.Line>(null);
  const glowTrailRef = useRef<THREE.Line>(null);
  const sparksRef = useRef<THREE.Points>(null);
  const pos = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3(0, 1, 0));
  const tmp = useRef(new THREE.Vector3());
  const [hovered, setHovered] = useState(false);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const coreGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(TRAIL_SEGMENTS * 3), 3)
    );
    return g;
  }, []);

  const glowGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(TRAIL_SEGMENTS * 3), 3)
    );
    return g;
  }, []);

  const sparkGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3)
    );
    const ages = new Float32Array(SPARK_COUNT);
    for (let i = 0; i < SPARK_COUNT; i++) ages[i] = Math.random();
    g.setAttribute("age", new THREE.BufferAttribute(ages, 1));
    return g;
  }, []);

  const coreLine = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: "#fff7ed",
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      linewidth: 1,
    });
    return new THREE.Line(coreGeom, mat);
  }, [coreGeom]);

  const glowLine = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: "#fb923c",
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Line(glowGeom, mat);
  }, [glowGeom]);

  const sparkMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#fdba74",
        size: 0.028,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    []
  );

  useEffect(() => {
    coreTrailRef.current = coreLine;
    glowTrailRef.current = glowLine;
    return () => {
      coreGeom.dispose();
      glowGeom.dispose();
      sparkGeom.dispose();
      (coreLine.material as THREE.Material).dispose();
      (glowLine.material as THREE.Material).dispose();
      sparkMat.dispose();
    };
  }, [coreLine, glowLine, coreGeom, glowGeom, sparkGeom, sparkMat]);

  useFrame((_, dt) => {
    if (opacity < 0.04) {
      if (headRef.current) headRef.current.visible = false;
      if (sparksRef.current) sparksRef.current.visible = false;
      return;
    }
    const t = Math.min(1, Math.max(0, progress));
    bezierPoint(track.start, track.mid, track.end, t, pos.current);
    bezierTangent(track.start, track.mid, track.end, t, dir.current);

    const entryBoost = t > 0.55 ? 0.6 + (t - 0.55) * 1.8 : 0.45;
    const fadeOut = t > 0.92 ? 1 - (t - 0.92) / 0.08 : 1;
    const sizeBoost = highlighted ? 1.2 : 1;

    if (headRef.current) {
      headRef.current.position.copy(pos.current);
      quat.setFromUnitVectors(up, dir.current);
      headRef.current.quaternion.copy(quat);
      const s = (hovered ? track.size * 1.35 : track.size) * fadeOut * sizeBoost;
      headRef.current.scale.setScalar(s / 0.03);
      headRef.current.visible = fadeOut > 0.05;
    }

    const writeTrail = (
      geom: THREE.BufferGeometry,
      mat: THREE.LineBasicMaterial,
      baseOpacity: number
    ) => {
      const attr = geom.getAttribute("position") as THREE.BufferAttribute;
      const trailLen = highlighted ? 0.16 : 0.12;
      for (let i = 0; i < TRAIL_SEGMENTS; i++) {
        const tt = Math.max(
          0,
          t - trailLen * (1 - i / Math.max(1, TRAIL_SEGMENTS - 1))
        );
        bezierPoint(track.start, track.mid, track.end, tt, tmp.current);
        attr.setXYZ(i, tmp.current.x, tmp.current.y, tmp.current.z);
      }
      attr.needsUpdate = true;
      mat.opacity = baseOpacity * entryBoost * fadeOut * opacity;
    };

    writeTrail(coreGeom, coreLine.material as THREE.LineBasicMaterial, 0.95);
    writeTrail(glowGeom, glowLine.material as THREE.LineBasicMaterial, 0.5);

    if (sparksRef.current) {
      const attr = sparkGeom.getAttribute("position") as THREE.BufferAttribute;
      const ages = sparkGeom.getAttribute("age") as THREE.BufferAttribute;
      const trailLen = highlighted ? 0.16 : 0.12;
      for (let i = 0; i < SPARK_COUNT; i++) {
        let age = ages.getX(i) + dt * (1.8 + (i % 3) * 0.4);
        if (age > 1) age = age % 1;
        ages.setX(i, age);
        const backT = Math.max(0, t - trailLen * age);
        bezierPoint(track.start, track.mid, track.end, backT, tmp.current);
        const base = tmp.current;
        const jitter = 0.012 * (1 - age);
        const seed = hashString(track.id + String(i));
        attr.setXYZ(
          i,
          base.x + (seededUnit(seed, 1) - 0.5) * jitter * 2,
          base.y + (seededUnit(seed, 2) - 0.5) * jitter * 2,
          base.z + (seededUnit(seed, 3) - 0.5) * jitter * 2
        );
      }
      attr.needsUpdate = true;
      ages.needsUpdate = true;
      sparkMat.opacity =
        0.7 * entryBoost * fadeOut * opacity * (hovered ? 1 : 0.85);
      sparksRef.current.visible = fadeOut > 0.08;
    }
  });

  if (opacity < 0.04) return null;

  const headScale = track.size;

  return (
    <group>
      <primitive object={glowLine} />
      <primitive object={coreLine} />
      <points ref={sparksRef} geometry={sparkGeom} material={sparkMat} />

      <group
        ref={headRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <mesh>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshBasicMaterial
            color="#ef4444"
            transparent
            opacity={0.22 * opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.038, 14, 14]} />
          <meshBasicMaterial
            color="#fb923c"
            transparent
            opacity={0.45 * opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshBasicMaterial
            color="#fffbeb"
            transparent
            opacity={0.95 * opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.04, 0]}>
          <coneGeometry args={[0.028, 0.11, 10, 1, true]} />
          <meshBasicMaterial
            color="#f97316"
            transparent
            opacity={0.55 * opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.03, 0]}>
          <coneGeometry args={[0.012, 0.08, 8, 1, true]} />
          <meshBasicMaterial
            color="#fef08a"
            transparent
            opacity={0.75 * opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <pointLight
          color="#fdba74"
          intensity={(hovered ? 2.2 : 1.35) * opacity}
          distance={1.1}
          decay={2}
        />
        <Html
          center
          distanceFactor={7}
          style={{ pointerEvents: "none", opacity }}
          zIndexRange={[100, 0]}
        >
          <div
            className={`-translate-y-6 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px] shadow-lg backdrop-blur-sm transition-opacity ${
              hovered
                ? "border-amber-400/80 bg-slate-950/90 text-amber-200 opacity-100"
                : "border-slate-600/60 bg-slate-950/70 text-slate-200 opacity-80"
            }`}
          >
            <span className="font-semibold text-cyan-200">{track.label}</span>
            <span className="mx-1 text-slate-500">·</span>
            <span className="font-bold text-amber-300">{track.ipLabel}</span>
          </div>
        </Html>
      </group>
      <mesh visible={false} scale={headScale / 0.03}>
        <sphereGeometry args={[0.06, 8, 8]} />
      </mesh>
    </group>
  );
}

function FireballFlash({
  pos,
  size,
  phase,
  paused,
  opacity,
}: {
  pos: THREE.Vector3;
  size: number;
  phase: number;
  paused: boolean;
  opacity: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (paused || !ref.current || opacity < 0.04) return;
    const t = (clock.elapsedTime * 0.7 + phase) % 1;
    const pulse = t < 0.25 ? Math.sin((t / 0.25) * Math.PI) : 0;
    ref.current.scale.setScalar(0.001 + pulse * size * 8);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = pulse * 0.55 * opacity;
  });
  if (opacity < 0.04) return null;
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial
        color="#fbbf24"
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function FireballImpacts({
  fireballs,
  paused,
  opacity,
}: {
  fireballs: Fireball[];
  paused: boolean;
  opacity: number;
}) {
  const points = useMemo(() => {
    return fireballs
      .filter(
        (f) =>
          f.lat != null &&
          f.lon != null &&
          Number.isFinite(f.lat) &&
          Number.isFinite(f.lon)
      )
      .slice(0, MAX_FIREBALLS)
      .map((f, i) => {
        const energy = f.energy ? parseFloat(f.energy) : 1;
        const size = Math.min(
          0.06,
          Math.max(0.015, Math.log10(energy + 1) * 0.02)
        );
        return {
          id: `${f.date}-${i}`,
          pos: latLonToVec3(f.lat!, f.lon!, EARTH_RADIUS * 1.012),
          size,
          phase: (hashString(f.date + String(i)) % 1000) / 1000,
        };
      });
  }, [fireballs]);

  return (
    <group>
      {points.map((p) => (
        <FireballFlash
          key={p.id}
          pos={p.pos}
          size={p.size}
          phase={p.phase}
          paused={paused}
          opacity={opacity}
        />
      ))}
    </group>
  );
}


function FollowCamera({
  playing,
  progress,
  primaryTrack,
  earthPos,
  controlsRef,
  followActiveRef,
}: {
  playing: boolean;
  progress: number;
  primaryTrack: MeteorTrack | null;
  earthPos: THREE.Vector3;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  followActiveRef: MutableRefObject<boolean>;
}) {
  const { camera } = useThree();
  const userOverride = useRef(false);
  const wasPlaying = useRef(false);
  const meteorLocal = useRef(new THREE.Vector3());
  const meteorWorld = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const desiredCam = useRef(new THREE.Vector3());
  const viewOffset = useRef(new THREE.Vector3(0.35, 0.55, 1));

  // Resume follow when Play is pressed again
  useEffect(() => {
    if (playing && !wasPlaying.current) {
      userOverride.current = false;
    }
    wasPlaying.current = playing;
  }, [playing]);

  useEffect(() => {
    let cancelled = false;
    let controls: OrbitControlsImpl | null = null;
    const onStart = () => {
      userOverride.current = true;
    };
    // OrbitControls ref may not be ready on first paint
    const tryAttach = () => {
      if (cancelled) return;
      controls = controlsRef.current;
      if (!controls) {
        raf = requestAnimationFrame(tryAttach);
        return;
      }
      controls.addEventListener("start", onStart);
    };
    let raf = requestAnimationFrame(tryAttach);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      controls?.removeEventListener("start", onStart);
    };
  }, [controlsRef]);

  useFrame((_, dt) => {
    const following =
      playing && !userOverride.current && primaryTrack != null;
    followActiveRef.current = following;
    if (!following || !primaryTrack) return;

    const controls = controlsRef.current;
    if (!controls) return;

    const t = Math.min(1, Math.max(0, progress));
    bezierPoint(
      primaryTrack.start,
      primaryTrack.mid,
      primaryTrack.end,
      t,
      meteorLocal.current
    );
    meteorWorld.current.copy(meteorLocal.current).add(earthPos);

    // Path span → pull back when approach starts farther out
    const pathSpan = primaryTrack.start.length();
    const farDist = Math.min(9.5, Math.max(3.4, pathSpan * 1.45));
    const nearDist = 2.05;
    // Closer near Earth entry (high progress)
    const zoomT = smoothstep(0.05, 0.92, t);
    const camDist = THREE.MathUtils.lerp(farDist, nearDist, zoomT);

    desiredTarget.current.copy(meteorWorld.current);

    // Keep a stable viewing offset; gently blend with current orbit direction
    const fromTarget = camera.position.clone().sub(controls.target);
    if (fromTarget.lengthSq() > 1e-6) {
      viewOffset.current.lerp(fromTarget.normalize(), 0.08);
      if (viewOffset.current.lengthSq() < 1e-6) {
        viewOffset.current.set(0.35, 0.55, 1).normalize();
      } else {
        viewOffset.current.normalize();
      }
    }
    desiredCam.current
      .copy(desiredTarget.current)
      .addScaledVector(viewOffset.current, camDist);

    const alpha = 1 - Math.exp(-4.2 * dt);
    controls.target.lerp(desiredTarget.current, alpha);
    camera.position.lerp(desiredCam.current, alpha);
    controls.update();
  });

  return null;
}

function LodController({
  earthPos,
  controlsRef,
  onLodChange,
  blendRef,
  followActiveRef,
}: {
  earthPos: THREE.Vector3;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  onLodChange?: Props["onLodChange"];
  blendRef: MutableRefObject<number>;
  followActiveRef: MutableRefObject<boolean>;
}) {
  const { camera } = useThree();
  const lastMode = useRef<LodMode | null>(null);
  const lastReport = useRef(0);

  useFrame(() => {
    // When not following a meteor, keep orbit target on Earth
    if (controlsRef.current && !followActiveRef.current) {
      controlsRef.current.target.lerp(earthPos, 0.12);
    }
    const dist = camera.position.distanceTo(earthPos);
    const blend = smoothstep(LOD_NEAR, LOD_FAR, dist);
    blendRef.current = blend;
    const mode: LodMode =
      blend < 0.25 ? "earth" : blend > 0.75 ? "solar" : "blend";
    const now = performance.now();
    if (
      onLodChange &&
      (mode !== lastMode.current || now - lastReport.current > 120)
    ) {
      lastMode.current = mode;
      lastReport.current = now;
      onLodChange({ blend, distance: dist, mode });
    }
  });

  return null;
}

function SceneContent({
  risks,
  fireballs,
  showFireballs,
  impactCountry,
  impactCountryReady,
  selectedIds,
  primaryId,
  paused,
  playing,
  progress,
  orbits,
  onLodChange,
  blendRef,
}: {
  risks: RiskEvent[];
  fireballs: Fireball[];
  showFireballs: boolean;
  impactCountry?: string | null;
  impactCountryReady?: boolean;
  selectedIds: string[];
  primaryId?: string | null;
  paused: boolean;
  playing: boolean;
  progress: number;
  orbits: Record<string, OrbitElements>;
  onLodChange?: Props["onLodChange"];
  blendRef: MutableRefObject<number>;
}) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const tracks = useMemo(() => buildTracks(risks), [risks]);
  const visibleTracks = useMemo(
    () => tracks.filter((t) => selectedSet.has(t.id)),
    [tracks, selectedSet]
  );
  const primaryTrack = useMemo(() => {
    if (!primaryId) return visibleTracks[0] ?? null;
    return (
      visibleTracks.find((t) => t.id === primaryId) ??
      tracks.find((t) => t.id === primaryId) ??
      null
    );
  }, [tracks, visibleTracks, primaryId]);

  const earthPos = useMemo(() => earthHeliocentricPosition(), []);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const followActiveRef = useRef(false);
  const [blend, setBlend] = useState(0);

  // Mirror blendRef into React state at a low rate for material opacity
  useFrame(() => {
    const b = blendRef.current;
    setBlend((prev) => (Math.abs(prev - b) > 0.02 ? b : prev));
  });

  const earthFade = 1 - blend;
  const solarFade = blend;
  // Show small Earth marker once detailed globe has mostly faded
  const showSolarEarth = blend > 0.55;

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <Stars
        radius={140}
        depth={60}
        count={4000}
        factor={3.2}
        saturation={0}
        fade
        speed={paused ? 0 : 0.35}
      />

      <LodController
        earthPos={earthPos}
        controlsRef={controlsRef}
        onLodChange={onLodChange}
        blendRef={blendRef}
        followActiveRef={followActiveRef}
      />
      <FollowCamera
        playing={playing && !paused}
        progress={progress}
        primaryTrack={primaryTrack}
        earthPos={earthPos}
        controlsRef={controlsRef}
        followActiveRef={followActiveRef}
      />

      {/* Heliocentric solar LOD — fades in as camera pulls away from Earth */}
      <SolarSystemView
        risks={risks}
        selectedIds={selectedIds}
        primaryId={primaryId}
        progress={progress}
        orbits={orbits}
        fade={solarFade}
        showEarthBody={showSolarEarth}
      />

      {/* Near-Earth LOD — textured globe + atmospheric trails at Earth's heliocentric seat */}
      <group position={earthPos}>
        <ambientLight intensity={0.35 * earthFade} />
        <directionalLight
          position={[5, 3, 5]}
          intensity={1.35 * earthFade}
          color="#fff6e8"
        />
        <directionalLight
          position={[-4, -2, -3]}
          intensity={0.25 * earthFade}
          color="#93c5fd"
        />
        <EarthWithFallback autoRotate={!paused} opacity={earthFade} />
        {visibleTracks.map((t) => (
          <group key={t.id}>
            <TrajectoryRibbon
              track={t}
              progress={progress}
              highlighted={t.id === primaryId}
              opacity={earthFade}
            />
            <ImpactMark
              end={t.end}
              highlighted={t.id === primaryId}
              opacity={earthFade}
              countryLabel={
                t.id === primaryId && impactCountryReady
                  ? impactCountry ?? null
                  : undefined
              }
            />
            <Meteor
              track={t}
              progress={progress}
              highlighted={t.id === primaryId}
              opacity={earthFade}
            />
          </group>
        ))}
        {showFireballs && (
          <FireballImpacts
            fireballs={fireballs}
            paused={paused}
            opacity={earthFade}
          />
        )}
      </group>

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.85}
        maxDistance={58}
        autoRotate={false}
        rotateSpeed={0.55}
        zoomSpeed={0.85}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}

export default function EarthGlobe({
  risks,
  fireballs,
  showFireballs = true,
  impactCountry = null,
  impactCountryReady = false,
  selectedIds,
  primaryId,
  className,
  progress = 0,
  playing = false,
  orbits = {},
  orbitsLoading = false,
  onLodChange,
}: Props) {
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lodMode, setLodMode] = useState<LodMode>("earth");
  const blendRef = useRef(0);

  const activeIds = selectedIds ?? [];

  const earthPos = useMemo(() => earthHeliocentricPosition(), []);
  const camPos = useMemo(
    (): [number, number, number] => [
      earthPos.x,
      earthPos.y + 0.55,
      earthPos.z + 3.15,
    ],
    [earthPos]
  );

  useEffect(() => {
    setMounted(true);
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const handleLod = useCallback(
    (info: { blend: number; distance: number; mode: LodMode }) => {
      setLodMode(info.mode);
      onLodChange?.(info);
    },
    [onLodChange]
  );

  const onCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, []);

  const fbCount = fireballs.filter(
    (f) => f.lat != null && f.lon != null
  ).length;

  const keplerCount = activeIds.reduce((n, id) => {
    const r = risks.find((x) => (x.id || x.des) === id);
    return n + (r && orbits[r.des]?.available ? 1 : 0);
  }, 0);

  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950 ${className ?? ""}`}
        style={{ minHeight: 360 }}
      >
        <p className="text-sm text-slate-500">Initializing 3D globe…</p>
      </div>
    );
  }

  const modeLabel =
    lodMode === "solar"
      ? "Solar system"
      : lodMode === "blend"
        ? "Zooming…"
        : "Near Earth";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 shadow-2xl shadow-cyan-950/30 ${className ?? ""}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-slate-950/90 to-transparent px-3 py-2 sm:px-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90">
            {modeLabel}
          </p>
          <p className="text-xs text-slate-400">
            Scroll / pinch to zoom from Earth trails out to heliocentric orbits
          </p>
        </div>
        <p className="hidden max-w-[42%] text-right text-[10px] text-slate-500 sm:block">
          Play follows meteor · drag overrides · scroll zooms
        </p>
      </div>

      <div
        className="h-[55vh] w-full min-h-[280px] touch-none overscroll-none sm:h-[min(70vh,720px)] sm:min-h-[420px]"
        style={{ touchAction: "none" }}
      >
        <Canvas
          camera={{
            position: camPos,
            fov: 42,
            near: 0.08,
            far: 500,
          }}
          dpr={[1, 1.75]}
          onCreated={onCreated}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Suspense fallback={null}>
            <SceneContent
              risks={risks}
              fireballs={fireballs}
              showFireballs={showFireballs}
              impactCountry={impactCountry}
              impactCountryReady={impactCountryReady}
              selectedIds={activeIds}
              primaryId={primaryId}
              paused={paused}
              playing={playing}
              progress={progress}
              orbits={orbits}
              onLodChange={handleLod}
              blendRef={blendRef}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950/80 to-transparent px-3 pb-1.5 pt-6 text-[10px] text-slate-500">
        <span>
          {lodMode === "solar"
            ? `${keplerCount}/${activeIds.length} Keplerian orbit${keplerCount === 1 ? "" : "s"}`
            : `${activeIds.length} trail${activeIds.length === 1 ? "" : "s"}${
                showFireballs ? ` · ${fbCount} fireballs` : ""
              }`}
          {orbitsLoading ? " · loading SBDB…" : ""}
          {paused ? " · tab paused" : ""}
        </span>
      </div>
    </div>
  );
}
