/**
 * Target positions for every particle in each shape. All shapes share the
 * same particle count so the shader can morph between any two of them.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flat grid — the shader animates it into the hero wave. */
function wave(count: number, r: () => number) {
  const out = new Float32Array(count * 3);
  const cols = Math.ceil(Math.sqrt(count * 2.4));
  const rows = Math.ceil(count / cols);
  for (let i = 0; i < count; i++) {
    const cx = i % cols;
    const cz = Math.floor(i / cols);
    out[i * 3] = (cx / (cols - 1) - 0.5) * 34 + (r() - 0.5) * 0.08;
    out[i * 3 + 1] = -2.2;
    out[i * 3 + 2] = (cz / Math.max(rows - 1, 1)) * -22 + 5 + (r() - 0.5) * 0.08;
  }
  return out;
}

/**
 * The Kleo Ring mark (kleo-platform components/brand/kleo-ring.tsx):
 * 200×200 grid, ring between r=60 and r=80, upper arc 30°→90°,
 * lower arc −150°→−30°, core disc r=22. Sampled by area and extruded.
 */
function ring(count: number, r: () => number) {
  const out = new Float32Array(count * 3);
  const deg = Math.PI / 180;
  const ringPerDeg = (Math.PI * (80 * 80 - 60 * 60)) / 360;
  const upper = 60 * ringPerDeg;
  const lower = 120 * ringPerDeg;
  const core = Math.PI * 22 * 22;
  const total = upper + lower + core;
  const scale = 2.9 / 80;
  for (let i = 0; i < count; i++) {
    const pick = r() * total;
    let x: number;
    let y: number;
    if (pick < upper + lower) {
      const a = pick < upper ? (30 + r() * 60) * deg : (-150 + r() * 120) * deg;
      const rad = Math.sqrt(60 * 60 + r() * (80 * 80 - 60 * 60));
      x = Math.cos(a) * rad;
      y = Math.sin(a) * rad;
    } else {
      const a = r() * Math.PI * 2;
      const rad = 22 * Math.sqrt(r());
      x = Math.cos(a) * rad;
      y = Math.sin(a) * rad;
    }
    out[i * 3] = x * scale;
    out[i * 3 + 1] = y * scale;
    out[i * 3 + 2] = (r() - 0.5) * 0.55;
  }
  return out;
}

/** Fibonacci sphere with a soft shell. */
function sphere(count: number, r: () => number) {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const shell = 3.1 + (r() - 0.5) * 0.25;
    out[i * 3] = Math.cos(th) * rad * shell;
    out[i * 3 + 1] = y * shell;
    out[i * 3 + 2] = Math.sin(th) * rad * shell;
  }
  return out;
}

/** Twelve small orbs on a circle — one per specialist. */
function clusters(count: number, r: () => number) {
  const out = new Float32Array(count * 3);
  const n = 12;
  for (let i = 0; i < count; i++) {
    const k = i % n;
    const a = (k / n) * Math.PI * 2;
    const cx = Math.cos(a) * 5.4;
    const cz = Math.sin(a) * 5.4;
    // Gaussian-ish blob
    const u = r() * Math.PI * 2;
    const v = Math.acos(2 * r() - 1);
    const rad = 0.62 * Math.cbrt(r());
    out[i * 3] = cx + Math.sin(v) * Math.cos(u) * rad;
    out[i * 3 + 1] = Math.cos(v) * rad;
    out[i * 3 + 2] = cz + Math.sin(v) * Math.sin(u) * rad;
  }
  return out;
}

/** Long cylinder along −z; the shader streams it past the camera. */
function tunnel(count: number, r: () => number) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const rad = 3.6 + (r() - 0.5) * 0.9 + (r() < 0.08 ? r() * 3 : 0);
    out[i * 3] = Math.cos(a) * rad;
    out[i * 3 + 1] = Math.sin(a) * rad;
    out[i * 3 + 2] = -42 + r() * 48;
  }
  return out;
}

export function buildShapes(count: number) {
  const r = rng(1337);
  const rand = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) rand[i] = r();
  return {
    wave: wave(count, r),
    ring: ring(count, r),
    sphere: sphere(count, r),
    clusters: clusters(count, r),
    tunnel: tunnel(count, r),
    rand,
  };
}
