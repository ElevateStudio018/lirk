"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { buildShapes } from "./shapes";
import { scene, STAGES } from "@/lib/scene";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uFrom;
  uniform float uTo;
  uniform float uMix;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  uniform float uPointerActive;
  uniform float uAspect;

  attribute vec3 aWave;
  attribute vec3 aRing;
  attribute vec3 aSphere;
  attribute vec3 aCluster;
  attribute vec3 aTunnel;
  attribute vec4 aRand;

  varying float vTone;
  varying float vAlpha;

  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

  vec3 waveShape(vec3 p) {
    float t = uTime;
    p.y += sin(p.x * 0.42 + t * 0.8) * 0.55
         + sin(p.z * 0.65 + t * 0.6) * 0.38
         + sin((p.x - p.z) * 0.25 + t * 0.45) * 0.4;
    return p;
  }
  vec3 ringShape(vec3 p) {
    p.xy = rot(-uTime * 0.16) * p.xy;               // the gaps imply rotation
    p.xz = rot(sin(uTime * 0.35) * 0.5) * p.xz;      // sway in depth
    p.yz = rot(cos(uTime * 0.27) * 0.22) * p.yz;
    return p;
  }
  vec3 sphereShape(vec3 p) {
    p *= 1.0 + 0.07 * sin(uTime * 1.3 + aRand.w * 6.2831);
    p.xz = rot(uTime * 0.12) * p.xz;
    p.xy = rot(0.35) * p.xy;
    return p;
  }
  vec3 clusterShape(vec3 p) {
    p.xz = rot(uTime * 0.14) * p.xz;
    p.yz = rot(0.3) * p.yz;
    return p;
  }
  vec3 tunnelShape(vec3 p) {
    p.z = mod(p.z + uTime * 3.4, 48.0) - 42.0;
    p.xy = rot(uTime * 0.1 + p.z * 0.025) * p.xy;
    return p;
  }
  vec3 shape(float i) {
    if (i < 0.5) return waveShape(aWave);
    if (i < 1.5) return ringShape(aRing);
    if (i < 2.5) return sphereShape(aSphere);
    if (i < 3.5) return clusterShape(aCluster);
    return tunnelShape(aTunnel);
  }
  vec3 swirl(vec3 p) {
    return vec3(
      sin(p.y * 1.3 + uTime * 0.7 + aRand.w * 6.0),
      sin(p.z * 1.1 + uTime * 0.6 + aRand.x * 6.0),
      sin(p.x * 1.2 + uTime * 0.5 + aRand.y * 6.0)
    );
  }

  void main() {
    // Staggered morph: each particle leaves at its own moment.
    float m = clamp(uMix * 1.6 - aRand.x * 0.6, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    vec3 pos = mix(shape(uFrom), shape(uTo), m);

    // Mid-morph the cloud bursts outwards and swirls, then re-forms.
    float burst = sin(m * 3.14159);
    pos += swirl(pos * 0.35) * burst * 1.7;
    pos += 0.025 * vec3(sin(uTime * 2.0 + aRand.w * 20.0), cos(uTime * 1.7 + aRand.x * 20.0), 0.0);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);

    // Pointer "leaf blower" (the hover on the current hero), in screen space.
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 d = ndc - uPointer;
    d.x *= uAspect;
    float dist = length(d);
    float f = smoothstep(0.34, 0.0, dist) * uPointerActive;
    vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0, 1.0);
    float depth = -mv.z;
    mv.xy += dir * f * depth * 0.13;
    mv.y += f * depth * 0.035;
    mv.z += f * 0.6;

    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.5 + aRand.z * 1.0) * (1.0 + f * 0.6);
    gl_PointSize = min(size * uPixelRatio * (10.0 / max(depth, 0.1)), 56.0 * uPixelRatio);

    vTone = aRand.y;
    vAlpha = smoothstep(55.0, 12.0, depth) * smoothstep(0.4, 2.2, depth);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform float uDark;
  varying float vTone;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.18, d);
    if (a < 0.01) discard;

    vec3 blue = vec3(0.039, 0.243, 1.0);   // #0a3eff
    vec3 sky  = vec3(0.435, 0.616, 1.0);   // #6f9dff
    vec3 navy = vec3(0.063, 0.161, 0.431); // #10296e
    vec3 ice  = vec3(0.80, 0.87, 1.0);

    vec3 light = vTone < 0.55 ? blue : (vTone < 0.8 ? sky : navy);
    vec3 dark  = vTone < 0.45 ? sky : (vTone < 0.85 ? ice : vec3(0.3, 0.5, 1.0));
    vec3 col = mix(light, dark, uDark);

    gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  }
`;

const smooth = (t: number) => t * t * (3 - 2 * t);

function Particles({ count }: { count: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { camera, size, gl } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const pointer = useRef({ x: 0, y: 0, active: 0 });
  const timeRef = useRef(0);

  const geometry = useMemo(() => {
    const s = buildShapes(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(s.wave, 3));
    g.setAttribute("aWave", new THREE.BufferAttribute(s.wave, 3));
    g.setAttribute("aRing", new THREE.BufferAttribute(s.ring, 3));
    g.setAttribute("aSphere", new THREE.BufferAttribute(s.sphere, 3));
    g.setAttribute("aCluster", new THREE.BufferAttribute(s.clusters, 3));
    g.setAttribute("aTunnel", new THREE.BufferAttribute(s.tunnel, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(s.rand, 4));
    // Shapes move in the shader, so never cull the cloud.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFrom: { value: 0 },
      uTo: { value: 0 },
      uMix: { value: 0 },
      uSize: { value: 3.1 },
      uPixelRatio: { value: 1 },
      uPointer: { value: new THREE.Vector2(9, 9) },
      uPointerActive: { value: 0 },
      uAspect: { value: 1 },
      uOpacity: { value: 1 },
      uDark: { value: 0 },
    }),
    [],
  );

  useFrame((_, delta) => {
    const u = material.current?.uniforms;
    if (!u) return;
    const dt = Math.min(delta, 1 / 20);
    timeRef.current += scene.reducedMotion ? dt * 0.15 : dt;

    // Stage → from/to/mix
    const s = Math.min(Math.max(scene.stage, 0), STAGES.length - 1);
    const i = Math.min(Math.floor(s), STAGES.length - 2);
    const mix = s - i;
    const a = STAGES[i];
    const b = STAGES[i + 1];
    const eased = smooth(Math.min(Math.max(mix, 0), 1));

    u.uTime.value = timeRef.current;
    u.uFrom.value = a.shape;
    u.uTo.value = b.shape;
    u.uMix.value = a.shape === b.shape ? 0 : mix;
    u.uOpacity.value = a.opacity + (b.opacity - a.opacity) * eased;
    u.uDark.value = scene.dark;
    u.uPixelRatio.value = gl.getPixelRatio();
    const aspect = size.width / size.height;
    u.uAspect.value = aspect;

    // Frame-rate independent easing.
    const step = Math.min(delta, 0.25);
    const ease = (rate: number) => 1 - Math.exp(-step * rate);

    // Pointer, eased so the particles glide back when it leaves.
    const p = pointer.current;
    p.x += (scene.pointer.x - p.x) * ease(7);
    p.y += (scene.pointer.y - p.y) * ease(7);
    p.active += (scene.pointer.active - p.active) * ease(3);
    u.uPointer.value.set(p.x, p.y);
    u.uPointerActive.value = p.active;

    // Camera: interpolate the stage rigs; on portrait screens centre and pull back.
    const narrow = aspect < 1;
    const xs = narrow ? 0 : 1;
    const zs = narrow ? 1.55 : 1;
    const lift = narrow ? (a.mY ?? 0) + ((b.mY ?? 0) - (a.mY ?? 0)) * eased : 0;
    camTarget.set(
      (a.cam[0] + (b.cam[0] - a.cam[0]) * eased) * xs + p.x * 0.35,
      a.cam[1] + (b.cam[1] - a.cam[1]) * eased + p.y * 0.2 + lift,
      (a.cam[2] + (b.cam[2] - a.cam[2]) * eased) * zs,
    );
    camera.position.lerp(camTarget, ease(4.5));
    look.set(
      (a.look[0] + (b.look[0] - a.look[0]) * eased) * xs,
      a.look[1] + (b.look[1] - a.look[1]) * eased + lift,
      a.look[2] + (b.look[2] - a.look[2]) * eased,
    );
    camera.lookAt(look);
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

export default function ParticleField() {
  const count = useMemo(() => {
    if (typeof window === "undefined") return 12000;
    const small = window.matchMedia("(max-width: 767px)").matches;
    const cores = navigator.hardwareConcurrency ?? 4;
    if (small) return 9000;
    return cores >= 8 ? 22000 : 15000;
  }, []);

  return (
    <div className="webgl" aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 45, near: 0.1, far: 120, position: [0, 1.5, 9] }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        flat
      >
        <Particles count={count} />
      </Canvas>
    </div>
  );
}
