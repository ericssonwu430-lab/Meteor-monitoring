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
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
  Sphere,
  Stars,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import type { Fireball, RiskEvent } from "@/types/neo";
import { formatImpactPercent } from "@/lib/format";

const EARTH_RADIUS = 1;
const MAX_METEORS = 22;
const MAX_FIREBALLS = 40;
const MAX_TRAILS = 18;

const EARTH_DIFFUSE =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg";
const EARTH_SPECULAR =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_specular_2048.jpg";
const EARTH_CLOUDS =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png";

type Props = {
  risks: RiskEvent[];
  fireballs: Fireball[];
  className?: string;
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
  color: string;
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

function ipColor(ip: number): string {
  if (ip >= 0.01) return "#f87171";
  if (ip >= 0.001) return "#fb923c";
  if (ip >= 0.0001) return "#fbbf24";
  return "#67e8f9";
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
    const size = 0.018 + Math.min(0.05, Math.log10(ip * 1e6 + 1) * 0.012);
    const speed = 0.12 + Math.min(0.35, ip * 40) + seededUnit(seed, 8) * 0.08;
    return {
      id: r.id || r.des,
      des: r.des,
      label: r.des,
      ip,
      ipLabel: formatImpactPercent(ip),
      start,
      mid,
      end,
      speed,
      size,
      color: ipColor(ip),
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

function Meteor({
  track,
  selected,
  onSelect,
  paused,
}: {
  track: MeteorTrack;
  selected: boolean;
  onSelect: (id: string | null) => void;
  paused: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Line>(null);
  const tRef = useRef(track.phase);
  const pos = useRef(new THREE.Vector3());
  const trailPts = useRef<THREE.Vector3[]>([]);
  const [hovered, setHovered] = useState(false);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(12 * 3);
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  const lineObj = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: track.color,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    return new THREE.Line(geometry, mat);
  }, [geometry, track.color]);

  useEffect(() => {
    trailRef.current = lineObj;
    return () => {
      geometry.dispose();
      (lineObj.material as THREE.Material).dispose();
    };
  }, [lineObj, geometry]);

  useFrame((_, dt) => {
    if (paused) return;
    tRef.current = (tRef.current + dt * track.speed * 0.15) % 1;
    const t = tRef.current;
    bezierPoint(track.start, track.mid, track.end, t, pos.current);
    if (groupRef.current) {
      groupRef.current.position.copy(pos.current);
      const s = selected || hovered ? track.size * 1.85 : track.size;
      groupRef.current.scale.setScalar(s / 0.03);
    }

    trailPts.current.push(pos.current.clone());
    if (trailPts.current.length > 14) trailPts.current.shift();
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < 12; i++) {
      const p = trailPts.current[Math.max(0, trailPts.current.length - 12 + i)];
      if (p) attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
    const mat = lineObj.material as THREE.LineBasicMaterial;
    mat.opacity = selected || hovered ? 0.9 : 0.45;
  });

  const showLabel = selected || hovered || track.ip >= 0.001;

  return (
    <group>
      <primitive object={lineObj} />
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(selected ? null : track.id);
        }}
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
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshBasicMaterial color={track.color} toneMapped={false} />
        </mesh>
        <pointLight
          color={track.color}
          intensity={selected || hovered ? 1.2 : 0.45}
          distance={0.85}
        />
        {showLabel && (
          <Html
            center
            distanceFactor={7}
            style={{ pointerEvents: "none" }}
            zIndexRange={[100, 0]}
          >
            <div
              className={`-translate-y-5 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px] shadow-lg backdrop-blur-sm ${
                selected || hovered
                  ? "scale-110 border-amber-400/80 bg-slate-950/90 text-amber-200"
                  : "border-slate-600/70 bg-slate-950/75 text-slate-200"
              }`}
            >
              <span className="font-semibold text-cyan-200">{track.label}</span>
              <span className="mx-1 text-slate-500">·</span>
              <span
                className={
                  selected || hovered
                    ? "text-sm font-bold text-amber-300"
                    : "text-amber-300/90"
                }
              >
                {track.ipLabel}
              </span>
            </div>
          </Html>
        )}
      </group>
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
    mat.opacity = pulse * 0.9;
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
        <FireballFlash key={p.id} pos={p.pos} size={p.size} phase={p.phase} paused={paused} />
      ))}
    </group>
  );
}

function SceneContent({
  risks,
  fireballs,
  paused,
}: {
  risks: RiskEvent[];
  fireballs: Fireball[];
  paused: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const tracks = useMemo(
    () => buildTracks(risks).slice(0, MAX_TRAILS),
    [risks]
  );
  const { gl } = useThree();

  useEffect(() => {
    const onMiss = () => setSelected(null);
    gl.domElement.addEventListener("pointermissed", onMiss);
    return () => gl.domElement.removeEventListener("pointermissed", onMiss);
  }, [gl]);

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 3, 5]} intensity={1.35} color="#fff6e8" />
      <directionalLight
        position={[-4, -2, -3]}
        intensity={0.25}
        color="#93c5fd"
      />
      <Stars
        radius={80}
        depth={50}
        count={3200}
        factor={3.2}
        saturation={0}
        fade
        speed={paused ? 0 : 0.4}
      />
      <EarthWithFallback autoRotate={!paused && !selected} />
      {tracks.map((t) => (
        <Meteor
          key={t.id}
          track={t}
          selected={selected === t.id}
          onSelect={setSelected}
          paused={paused}
        />
      ))}
      <FireballImpacts fireballs={fireballs} paused={paused} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.8}
        maxDistance={6}
        autoRotate={false}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
      />
    </>
  );
}

export default function EarthGlobe({ risks, fireballs, className }: Props) {
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  const trailCount = Math.min(risks.length, MAX_TRAILS);
  const fbCount = fireballs.filter(
    (f) => f.lat != null && f.lon != null
  ).length;

  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950 ${className ?? ""}`}
        style={{ minHeight: 420 }}
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
            Live 3D Earth
          </p>
          <p className="text-xs text-slate-400">
            Sentry risk meteors · impact % · recent fireball flashes
          </p>
        </div>
        <p className="hidden text-[10px] text-slate-500 sm:block">
          Drag to orbit · scroll to zoom · click a meteor
        </p>
      </div>

      <div className="h-[min(62vh,560px)] w-full min-h-[360px] touch-none">
        <Canvas
          camera={{ position: [0, 0.6, 3.2], fov: 42, near: 0.1, far: 200 }}
          dpr={[1, 1.75]}
          onCreated={onCreated}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
        >
          <Suspense fallback={null}>
            <SceneContent
              risks={risks}
              fireballs={fireballs}
              paused={paused}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 px-3 py-2 text-[11px] text-slate-500">
        <span>
          {trailCount} meteor trails · {fbCount} fireballs
        </span>
        <span className="text-slate-600">
          {paused ? "Paused (tab hidden)" : "Animating"}
        </span>
      </div>
    </div>
  );
}
