import { describe, expect, it } from "vitest";
import { attemptWeight, classifyPattern, confidenceMultiplier, estimateMastery, masteryStatus, type Evidence } from "@/lib/engine/mastery";

const now = new Date("2026-10-01T12:00:00Z");
const ev = (score: number, daysAgo = 0, weight = 1, source: Evidence["source"] = "exercise"): Evidence => ({
  score,
  weight,
  source,
  created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
});

describe("mastery model", () => {
  it("returns null mastery and zero confidence without evidence", () => {
    const m = estimateMastery([], now);
    expect(m.mastery).toBeNull();
    expect(m.confidence).toBe(0);
    expect(m.pattern).toBe("insufficient_evidence");
  });

  it("a single wrong answer does not mean poor mastery – it means too little data", () => {
    const m = estimateMastery([ev(0)], now);
    expect(m.confidence).toBeLessThan(0.3);
    expect(masteryStatus(m.mastery, m.confidence)).toBe("unknown");
  });

  it("one error after a history of success keeps mastery high", () => {
    const m = estimateMastery([ev(1, 3), ev(1, 2), ev(1, 2), ev(1, 1), ev(0, 0)], now);
    expect(m.mastery).toBeGreaterThan(0.65);
    expect(m.confidence).toBeGreaterThan(0.6);
  });

  it("consistent failure gives low mastery with growing confidence", () => {
    const few = estimateMastery([ev(0), ev(0)], now);
    const many = estimateMastery([ev(0), ev(0), ev(0), ev(0), ev(0), ev(0)], now);
    expect(many.mastery!).toBeLessThan(0.2);
    expect(many.confidence).toBeGreaterThan(few.confidence);
    expect(many.pattern).toBe("consistent_failure");
    expect(masteryStatus(many.mastery, many.confidence)).toBe("bad");
  });

  it("classifies consistent success, mixed and insufficient evidence", () => {
    expect(classifyPattern([ev(1), ev(1), ev(0.9), ev(1)])).toBe("consistent_success");
    expect(classifyPattern([ev(1), ev(0), ev(1), ev(0)])).toBe("mixed");
    expect(classifyPattern([ev(1)])).toBe("insufficient_evidence");
  });

  it("weights mock exams higher than checkpoints", () => {
    const mock = estimateMastery([ev(1, 0, 1, "mock")], now);
    const cp = estimateMastery([ev(1, 0, 1, "checkpoint")], now);
    expect(mock.confidence).toBeGreaterThan(cp.confidence);
  });

  it("old evidence decays so recent performance matters more", () => {
    const oldFail = estimateMastery([ev(0, 60), ev(0, 60), ev(1, 0), ev(1, 0)], now);
    const recentFail = estimateMastery([ev(1, 60), ev(1, 60), ev(0, 0), ev(0, 0)], now);
    expect(oldFail.mastery!).toBeGreaterThan(recentFail.mastery!);
  });

  it("multiple choice counts less than an explanation", () => {
    expect(attemptWeight("mcq")).toBeLessThan(attemptWeight("explain"));
  });
});

describe("confidence rating", () => {
  it("a lucky guess counts half, a confident mistake counts more", () => {
    expect(confidenceMultiplier("guess", true)).toBe(0.5);
    expect(confidenceMultiplier("sure", false)).toBe(1.25);
    expect(confidenceMultiplier("sure", true)).toBe(1);
    expect(confidenceMultiplier("think", false)).toBe(1);
    expect(confidenceMultiplier(null, true)).toBe(1);
  });
});
