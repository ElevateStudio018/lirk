import { describe, expect, it } from "vitest";
import { evaluateCheckpointLocally } from "@/lib/video/checkpoint";
import { equationsLesson } from "@/lib/video/samples/equations";
import { greenhouseLesson } from "@/lib/video/samples/greenhouse";
import { Lesson, SCENE_TYPES, sanitizeScene, validateLesson, type Scene } from "@/lib/video/schema";
import { computeTimeline, FPS, sceneFrames, sceneIndexAtFrame } from "@/lib/video/timing";

describe("scene schema & sample lessons", () => {
  it("both test lessons (two different subjects) are valid lesson JSON", () => {
    expect(Lesson.safeParse(greenhouseLesson).success).toBe(true);
    expect(Lesson.safeParse(equationsLesson).success).toBe(true);
    expect(validateLesson(greenhouseLesson).problems).toEqual([]);
    expect(validateLesson(equationsLesson).problems).toEqual([]);
  });

  it("together the test lessons exercise every scene template", () => {
    const used = new Set<string>([...greenhouseLesson.scenes, ...equationsLesson.scenes].map((s) => s.type));
    const missing = SCENE_TYPES.filter((t) => !used.has(t));
    expect(missing).toEqual([]);
  });

  it("rejects unknown scene types and malformed visuals", () => {
    const bad = { ...greenhouseLesson, scenes: [...greenhouseLesson.scenes, { ...greenhouseLesson.scenes[0], type: "hologram" }] };
    expect(Lesson.safeParse(bad).success).toBe(false);
  });

  it("repairs what can be repaired: stray emphasis, out-of-range checkpoints", () => {
    const scene = { ...greenhouseLesson.scenes[1], emphasis: ["finns inte i texten"], duration: 99 } as Scene;
    const clean = sanitizeScene(scene);
    expect(clean.emphasis).toEqual([]);
    expect(clean.duration).toBe(30);
    const fixed = validateLesson({ ...greenhouseLesson, checkpoints: [{ ...greenhouseLesson.checkpoints[0], after_scene: 99 }] });
    expect(fixed.lesson.checkpoints[0].after_scene).toBe(greenhouseLesson.scenes.length - 1);
    const broken = validateLesson({ ...greenhouseLesson, checkpoints: [{ ...greenhouseLesson.checkpoints[0], correct_index: 9 }] });
    expect(broken.problems.length).toBe(1);
  });
});

describe("timing", () => {
  it("scenes last long enough for their narration", () => {
    const s = { duration: 2, narration: "ord ".repeat(46) };
    expect(sceneFrames(s)).toBeGreaterThanOrEqual(20 * FPS);
  });
  it("timeline is contiguous and frame→scene lookup works", () => {
    const { timings, totalFrames } = computeTimeline(greenhouseLesson.scenes);
    expect(timings[0].from).toBe(0);
    for (let i = 1; i < timings.length; i++) expect(timings[i].from).toBe(timings[i - 1].from + timings[i - 1].frames);
    expect(totalFrames).toBe(timings.at(-1)!.from + timings.at(-1)!.frames);
    expect(sceneIndexAtFrame(timings, timings[3].from + 1)).toBe(3);
  });
});

describe("checkpoints", () => {
  const cp = greenhouseLesson.checkpoints[0];
  it("correct answer continues", () => {
    expect(evaluateCheckpointLocally(cp, cp.correct_index, 1)).toMatchObject({ correct: true, decision: "continue" });
  });
  it("an option revealing a misconception inserts the micro-lesson", () => {
    const r = evaluateCheckpointLocally(cp, 2, 1);
    expect(r.decision).toBe("insert_micro_lesson");
    expect(r.remedyScenes.length).toBeGreaterThan(0);
  });
  it("a wrong answer without misconception continues first, inserts on second failure", () => {
    const plain = { ...cp, misconception_by_option: [null, null, null] };
    expect(evaluateCheckpointLocally(plain, 1, 1).decision).toBe("continue");
    expect(evaluateCheckpointLocally(plain, 1, 2).decision).toBe("insert_micro_lesson");
  });
});

import { niceScale, prettyMath } from "@/remotion/scenes/math-scenes";

describe("scene helpers", () => {
  it("nice axis scales", () => {
    expect(niceScale(285, 421)).toEqual({ min: 250, max: 450, step: 50 });
    expect(niceScale(2, 17)).toEqual({ min: 0, max: 20, step: 5 });
    expect(niceScale(-4, 6).min).toBeLessThanOrEqual(-4);
  });
  it("pretty prints plain-text math", () => {
    expect(prettyMath("2 * x^2 - 3")).toBe("2 · x² − 3");
  });
});
