/**
 * Shared, mutable state between the DOM (GSAP/ScrollTrigger) and the WebGL
 * particle field. Written by SceneDirector on every tick, read in useFrame.
 */

export type Vec3 = [number, number, number];

export interface Stage {
  /** Particle shape: 0 wave · 1 Kleo ring · 2 sphere · 3 twelve clusters · 4 tunnel */
  shape: number;
  cam: Vec3;
  look: Vec3;
  opacity: number;
  /** Portrait screens: lift the camera so the shape sits lower, below the copy. */
  mY?: number;
}

/**
 * The particle journey down the page. Sections carry `data-stage={index}`;
 * the field morphs into a stage while its section scrolls into view.
 */
export const STAGES: Stage[] = [
  { shape: 0, cam: [0, 1.5, 9], look: [0, -0.9, 0], opacity: 1 }, // hero: wave (as on the current site)
  { shape: 1, cam: [-3.0, 0, 11], look: [-3.0, 0, 0], opacity: 1, mY: 3.2 }, // values: Kleo ring, right side
  { shape: 2, cam: [0, -0.4, 7.2], look: [0, -0.4, 0], opacity: 0.55 }, // product: sphere haloing the app screen
  { shape: 3, cam: [0, 2.4, 12.5], look: [0, -0.2, 0], opacity: 1 }, // specialists: twelve clusters
  { shape: 4, cam: [0, 0, 8], look: [0, 0, -10], opacity: 1 }, // steps: tunnel
  { shape: 0, cam: [0, 3.2, 10], look: [0, -2.2, 0], opacity: 0.35 }, // why → FAQ: calm wave
  { shape: 1, cam: [0, -3.9, 18], look: [0, -3.9, 0], opacity: 1, mY: -0.6 }, // finale: ring above the last call to action
];

export const scene = {
  /** Continuous stage index, 0 … STAGES.length - 1 */
  stage: 0,
  /** 0 = light page, 1 = dark section */
  dark: 0,
  pointer: { x: 0, y: 0, active: 0 },
  reducedMotion: false,
};
