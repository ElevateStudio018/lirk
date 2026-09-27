import type { Scene } from "./schema";

export const FPS = 30;

/** Average Swedish speech tempo in a calm teaching voice. */
const WORDS_PER_SECOND = 2.3;

/** Seconds a scene needs so the narration can be read aloud without rushing. */
export function sceneSeconds(scene: Pick<Scene, "duration" | "narration">): number {
  const words = scene.narration.trim().split(/\s+/).filter(Boolean).length;
  const spoken = words / WORDS_PER_SECOND + 1.2;
  return Math.max(scene.duration, spoken, 3);
}

export function sceneFrames(scene: Pick<Scene, "duration" | "narration">): number {
  return Math.round(sceneSeconds(scene) * FPS);
}

export type SceneTiming = { index: number; from: number; frames: number };

export function computeTimeline(scenes: Array<Pick<Scene, "duration" | "narration">>): {
  timings: SceneTiming[];
  totalFrames: number;
} {
  let from = 0;
  const timings = scenes.map((scene, index) => {
    const frames = sceneFrames(scene);
    const t = { index, from, frames };
    from += frames;
    return t;
  });
  return { timings, totalFrames: Math.max(1, from) };
}

export function sceneIndexAtFrame(timings: SceneTiming[], frame: number): number {
  for (let i = timings.length - 1; i >= 0; i--) if (frame >= timings[i].from) return i;
  return 0;
}
