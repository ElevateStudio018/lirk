import { describe, expect, it } from "vitest";
import { computeReadiness, readinessLabel, retentionFactor } from "@/lib/engine/readiness";

const now = new Date("2026-10-10T12:00:00Z");

describe("readiness (provberedskap)", () => {
  it("is an importance-weighted average and exposes every component", () => {
    const r = computeReadiness(
      [
        { id: "a", title: "A", importance: 5, mastery: 1, confidence: 1, lastPracticedAt: now.toISOString() },
        { id: "b", title: "B", importance: 1, mastery: 0, confidence: 1, lastPracticedAt: now.toISOString() },
      ],
      now,
    );
    expect(r.score).toBeCloseTo(5 / 6, 2);
    expect(r.topics[0]).toMatchObject({ topic_id: "a", importance: 5, mastery: 1, confidence: 1 });
  });

  it("unmeasured topics lower coverage, not just the score", () => {
    const r = computeReadiness([
      { id: "a", title: "A", importance: 1, mastery: 0.9, confidence: 0.8, lastPracticedAt: null },
      { id: "b", title: "B", importance: 1, mastery: null, confidence: 0, lastPracticedAt: null },
    ]);
    expect(r.coverage).toBeCloseTo(0.5);
    expect(r.topics.find((t) => t.topic_id === "b")!.measured).toBe(false);
  });

  it("retention decays with time and recovers with reviews", () => {
    expect(retentionFactor(0)).toBe(1);
    expect(retentionFactor(10)).toBeLessThan(retentionFactor(2));
    expect(retentionFactor(10, 3)).toBeGreaterThan(retentionFactor(10, 0));
    expect(retentionFactor(1000)).toBeGreaterThanOrEqual(0.7);
  });

  it("never claims readiness without coverage", () => {
    expect(readinessLabel(0.9, 0.2)).toBe("För tidigt att säga");
  });
});
