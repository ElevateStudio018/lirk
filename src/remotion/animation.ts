import { Easing, interpolate, spring } from "remotion";

export const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** 0→1 over `duration` frames starting at `delay`. */
export function progress(frame: number, delay: number, duration = 18) {
  return interpolate(frame, [delay, delay + duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}

export function pop(frame: number, fps: number, delay = 0) {
  return spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 140, mass: 0.7 } });
}

/** Common enter style: fade + rise. */
export function enter(frame: number, delay: number, distance = 24, duration = 18): React.CSSProperties {
  const p = progress(frame, delay, duration);
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
}

/** Spreads reveals of `count` items over the available frames. */
export function staggerDelay(index: number, count: number, start: number, available: number, min = 8, max = 30) {
  const step = Math.min(max, Math.max(min, available / Math.max(1, count)));
  return start + index * step;
}
