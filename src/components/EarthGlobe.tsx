"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Html,
  Line,
  OrbitControls,
  Sphere,
  Stars,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import type { Fireball, OrbitElements, RiskEvent } from "@/types/neo";
import { formatImpactPercent } from "@/lib/format";
import SolarSystemView from "@/components/SolarSystemView";

const EARTH_RADIUS = 1;
const MAX_METEORS = 22;
const MAX_FIREBALLS = 40;
const TRAIL_SEGMENTS = 28;
const SPARK_COUNT = 8;

const EARTH_DIFFUSE =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg";
const EARTH_SPECULAR =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_specular_2048.jpg";
const EARTH_CLOUDS =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png";

export type GlobeViewMode = "earth" | "solar";

type Props = {
  risks: RiskEvent[];
  fireballs: Fireball[];
  /** Ids of meteors whose trails should animate on the globe */
  selectedIds?: string[];
  primaryId?: string | null;
  className?: string;
  viewMode?: GlobeViewMode;
  /** Shared 0..1 scrub progress for trajectory / Keplerian position */
  progress?: number;
  playing?: boolean;
  orbits?: Record<string, OrbitElements>;
  orbitsLoading?: boolean;
};

type MeteorTrack = {
  id: string;
  des: string;
  label: string;
  ip: number;
  ipLabel: string;
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

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
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
  // derivative of quadratic bezier
  out.set(0, 0, 0);
  out.addScaledVector(a, 2 * (t - 1));
  out.addScaledVector(b, 2 - 4 * t);
  out.addScaledVector(c, 2 * t);
  return out.normalize();
}

function sampleBezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, n = 56): THREE.Vector3[] {
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
}: {
  track: MeteorTrack;
  progress: number;
  highlighted: boolean;
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
    return new THREE.TubeGeometry(curve, 48, highlighted ? 0.016 : 0.01, 6, false);
  }, [fullPts, highlighted]);

  useEffect(() => () => tube.dispose(), [tube]);

  return (
    <group>
      <mesh geometry={tube}>
        <meshBasicMaterial
          color={highlighted ? "#fb923c" : "#64748b"}
          transparent
          opacity={highlighted ? 0.38 : 0.22}
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
        opacity={0.95}
        depthWrite={false}
      />
    </group>
  );
}

function ImpactMark({ end, highlighted }: { end: THREE.Vector3; highlighted: boolean }) {
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), end.clone().normalize());
    return q;
  }, [end]);
  return (
    <mesh position={end} quaternion={quat}>
      <ringGeometry args={highlighted ? [0.028, 0.048, 24] : [0.02, 0.034, 20]} />
      <meshBasicMaterial
        color={highlighted ? "#f87171" : "#fb923c"}
        transparent
        opacity={highlighted ? 0.85 : 0.45}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
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

function Atmosphere() {
  return (
    <Sphere args={[EARTH_RADIUS * 1.045, 32, 32]}>
      <meshBasicMaterial
        color="#38bdf8"
        transparent
        opacity={0.08}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </Sphere>
  );
}

function TexturedEarth({ autoRotate }: { autoRotate: boolean }) {
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
    <group>
      <Sphere ref={earthRef} args={[EARTH_RADIUS, 64, 64]}>
        <meshPhongMaterial
          map={map}
          specularMap={spec}
          specular={new THREE.Color("#335566")}
          shininess={12}
        />
      </Sphere>
      <Sphere ref={cloudRef} args={[EARTH_RADIUS * 1.015, 48, 48]}>
        <meshPhongMaterial
          map={clouds}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </Sphere>
      <Atmosphere />
    </group>
  );
}

function ProceduralEarth({ autoRotate }: { autoRotate: boolean }) {
  const { earthRef, cloudRef } = useEarthSpin(autoRotate);
  return (
    <group>
      <Sphere ref={earthRef} args={[EARTH_RADIUS, 64, 64]}>
        <meshPhongMaterial
          color="#1d4f8c"
          emissive="#0a1f33"
          specular="#4a90a4"
          shininess={18}
        />
      </Sphere>
      <Sphere args={[EARTH_RADIUS * 1.002, 48, 48]}>
        <meshBasicMaterial
          color="#1a7a4c"
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </Sphere>
      <Sphere ref={cloudRef} args={[EARTH_RADIUS * 1.015, 48, 48]}>
        <meshPhongMaterial
          color="#e2e8f0"
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </Sphere>
      <Atmosphere />
    </group>
  );
}

function EarthWithFallback({ autoRotate }: { autoRotate: boolean }) {
  return (
    <TextureErrorBoundary fallback={<ProceduralEarth autoRotate={autoRotate} />}>
      <Suspense fallback={<ProceduralEarth autoRotate={autoRotate} />}>
        <TexturedEarth autoRotate={autoRotate} />
      </Suspense>
    </TextureErrorBoundary>
  );
}

/** Realistic shooting-star: elongated glowing head + tapered multi-layer trail + sparks */
function Meteor({
  track,
  progress,
  highlighted,
}: {
  track: MeteorTrack;
  progress: number;
  highlighted: boolean;
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
    const t = Math.min(1, Math.max(0, progress));
    bezierPoint(track.start, track.mid, track.end, t, pos.current);
    bezierTangent(track.start, track.mid, track.end, t, dir.current);

    // Brighten near atmosphere entry
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
        const tt = Math.max(0, t - trailLen * (1 - i / Math.max(1, TRAIL_SEGMENTS - 1)));
        bezierPoint(track.start, track.mid, track.end, tt, tmp.current);
        attr.setXYZ(i, tmp.current.x, tmp.current.y, tmp.current.z);
      }
      attr.needsUpdate = true;
      mat.opacity = baseOpacity * entryBoost * fadeOut;
    };

    writeTrail(coreGeom, coreLine.material as THREE.LineBasicMaterial, 0.95);
    writeTrail(glowGeom, glowLine.material as THREE.LineBasicMaterial, 0.5);

    // Brief spark particles trailing behind the head
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
      sparkMat.opacity = 0.7 * entryBoost * fadeOut * (hovered ? 1 : 0.85);
      sparksRef.current.visible = fadeOut > 0.08;
    }
  });

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
        {/* Outer orange/red glow shell */}
        <mesh>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshBasicMaterial
            color="#ef4444"
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {/* Mid orange glow */}
        <mesh>
          <sphereGeometry args={[0.038, 14, 14]} />
          <meshBasicMaterial
            color="#fb923c"
            transparent
            opacity={0.45}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {/* Hot white/yellow core */}
        <mesh>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshBasicMaterial
            color="#fffbeb"
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {/* Elongated fireball / tapered cone pointing opposite travel (trail side) */}
        <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.04, 0]}>
          <coneGeometry args={[0.028, 0.11, 10, 1, true]} />
          <meshBasicMaterial
            color="#f97316"
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Inner luminous taper */}
        <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.03, 0]}>
          <coneGeometry args={[0.012, 0.08, 8, 1, true]} />
          <meshBasicMaterial
            color="#fef08a"
            transparent
            opacity={0.75}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <pointLight
          color="#fdba74"
          intensity={hovered ? 2.2 : 1.35}
          distance={1.1}
          decay={2}
        />
        <Html
          center
          distanceFactor={7}
          style={{ pointerEvents: "none" }}
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
      {/* invisible hit target sized for readability */}
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
}: {
  pos: THREE.Vector3;
  size: number;
  phase: number;
  paused: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (paused || !ref.current) return;
    const t = (clock.elapsedTime * 0.7 + phase) % 1;
    const pulse = t < 0.25 ? Math.sin((t / 0.25) * Math.PI) : 0;
    ref.current.scale.setScalar(0.001 + pulse * size * 8);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = pulse * 0.55;
  });
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
}: {
  fireballs: Fireball[];
  paused: boolean;
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
        />
      ))}
    </group>
  );
}

function SceneContent({
  risks,
  fireballs,
  selectedIds,
  primaryId,
  paused,
  viewMode,
  progress,
  orbits,
}: {
  risks: RiskEvent[];
  fireballs: Fireball[];
  selectedIds: string[];
  primaryId?: string | null;
  paused: boolean;
  viewMode: GlobeViewMode;
  progress: number;
  orbits: Record<string, OrbitElements>;
}) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const tracks = useMemo(() => buildTracks(risks), [risks]);
  const visibleTracks = useMemo(
    () => tracks.filter((t) => selectedSet.has(t.id)),
    [tracks, selectedSet]
  );

  const solar = viewMode === "solar";

  return (
    <>
      <Stars
        radius={solar ? 120 : 80}
        depth={50}
        count={solar ? 4200 : 3200}
        factor={3.2}
        saturation={0}
        fade
        speed={paused ? 0 : 0.4}
      />
      {solar ? (
        <SolarSystemView
          risks={risks}
          selectedIds={selectedIds}
          primaryId={primaryId}
          progress={progress}
          orbits={orbits}
        />
      ) : (
        <>
          <color attach="background" args={["#020617"]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 3, 5]} intensity={1.35} color="#fff6e8" />
          <directionalLight
            position={[-4, -2, -3]}
            intensity={0.25}
            color="#93c5fd"
          />
          <EarthWithFallback autoRotate={!paused} />
          {visibleTracks.map((t) => (
            <group key={t.id}>
              <TrajectoryRibbon
                track={t}
                progress={progress}
                highlighted={t.id === primaryId}
              />
              <ImpactMark end={t.end} highlighted={t.id === primaryId} />
              <Meteor
                track={t}
                progress={progress}
                highlighted={t.id === primaryId}
              />
            </group>
          ))}
          <FireballImpacts fireballs={fireballs} paused={paused} />
        </>
      )}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={solar ? 4 : 1.8}
        maxDistance={solar ? 48 : 6}
        autoRotate={false}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
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
  selectedIds,
  primaryId,
  className,
  viewMode = "earth",
  progress = 0,
  playing = false,
  orbits = {},
  orbitsLoading = false,
}: Props) {
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);

  const activeIds = selectedIds ?? [];
  const solar = viewMode === "solar";

  useEffect(() => {
    setMounted(true);
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

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

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 shadow-2xl shadow-cyan-950/30 ${className ?? ""}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-slate-950/90 to-transparent px-3 py-2 sm:px-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90">
            {solar ? "Solar system" : "Live 3D Earth"}
          </p>
          <p className="text-xs text-slate-400">
            {solar
              ? "Keplerian orbits from JPL SBDB · Earth for scale"
              : "Trajectory ribbons · shooting stars · fireball flashes"}
          </p>
        </div>
        <p className="hidden max-w-[40%] text-right text-[10px] text-slate-500 sm:block">
          Drag to orbit · pinch/scroll to zoom · timeline scrubs path
        </p>
      </div>

      <div
        className="h-[min(58vh,520px)] w-full min-h-[300px] touch-none overscroll-none sm:min-h-[360px]"
        style={{ touchAction: "none" }}
      >
        <Canvas
          key={viewMode}
          camera={{
            position: solar ? [0, 6, 14] : [0, 0.6, 3.2],
            fov: 42,
            near: 0.1,
            far: 400,
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
              selectedIds={activeIds}
              primaryId={primaryId}
              paused={paused}
              viewMode={viewMode}
              progress={progress}
              orbits={orbits}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 px-3 py-2 text-[11px] text-slate-500">
        <span>
          {solar
            ? `${keplerCount}/${activeIds.length} Keplerian orbit${keplerCount === 1 ? "" : "s"} from SBDB`
            : `${activeIds.length} ribbon${activeIds.length === 1 ? "" : "s"} · ${fbCount} fireball flashes`}
          {solar && orbitsLoading ? " · loading SBDB…" : ""}
        </span>
        <span className="text-slate-600">
          {paused ? "Paused (tab hidden)" : playing ? "Playing" : "Scrub or play"}
        </span>
      </div>
    </div>
  );
}
