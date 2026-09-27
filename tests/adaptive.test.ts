import { describe, expect, it } from "vitest";
import { decideNext, type AdaptiveInput } from "@/lib/engine/adaptive";

const input = (over: Partial<AdaptiveInput> = {}): AdaptiveInput => ({
  context: "after_practice",
  topic: { id: "t1", title: "Ekvationer", mastery: 0.6, confidence: 0.5, pattern: "mixed", importance: 4 },
  prerequisites: [],
  recent: [],
  inserted: { micro: 0, easier: 0, harder: 0, review: 0 },
  ...over,
});

describe("adaptive rule engine", () => {
  it("SKIP: known topic with high confidence before the lesson", () => {
    const d = decideNext(input({ context: "before_lesson", topic: { id: "t1", title: "X", mastery: 0.9, confidence: 0.7, pattern: "consistent_success", importance: 3 } }));
    expect(d.action).toBe("SKIP");
    expect(d.rule).toBe("R1_SKIP_KNOWN");
  });

  it("does not skip when confidence is low (too little data)", () => {
    const d = decideNext(input({ context: "before_lesson", topic: { id: "t1", title: "X", mastery: 0.9, confidence: 0.3, pattern: "insufficient_evidence", importance: 3 } }));
    expect(d.action).toBe("CONTINUE");
  });

  it("MICRO_LESSON: a wrong answer with a named misconception", () => {
    const d = decideNext(input({ recent: [{ score: 0, is_correct: false, error_type: "misconception", misconception: "Blandar ihop väder och klimat" }] }));
    expect(d.action).toBe("MICRO_LESSON");
    expect(d.focus).toBe("Blandar ihop väder och klimat");
  });

  it("only one micro-lesson per topic and session", () => {
    const d = decideNext(input({ recent: [{ score: 0, is_correct: false, error_type: "misconception", misconception: "M" }], inserted: { micro: 1, easier: 0, harder: 0, review: 0 } }));
    expect(d.action).not.toBe("MICRO_LESSON");
  });

  it("EASIER_EXAMPLE: prerequisite gap targets the weak prerequisite", () => {
    const d = decideNext(
      input({
        prerequisites: [{ id: "pre", title: "Prioriteringsregler", mastery: 0.3, confidence: 0.5 }],
        recent: [
          { score: 0, is_correct: false, error_type: "calculation", misconception: null },
          { score: 0.2, is_correct: false, error_type: "method", misconception: null },
        ],
      }),
    );
    expect(d.action).toBe("EASIER_EXAMPLE");
    expect(d.targetTopicId).toBe("pre");
  });

  it("HARDER_QUESTION: strong recent performance", () => {
    const d = decideNext(
      input({
        topic: { id: "t1", title: "X", mastery: 0.8, confidence: 0.6, pattern: "consistent_success", importance: 3 },
        recent: [
          { score: 1, is_correct: true, error_type: null, misconception: null },
          { score: 1, is_correct: true, error_type: null, misconception: null },
          { score: 0.9, is_correct: true, error_type: null, misconception: null },
        ],
      }),
    );
    expect(d.action).toBe("HARDER_QUESTION");
  });

  it("REVIEW: low hit rate without a specific cause", () => {
    const d = decideNext(
      input({
        recent: [
          { score: 0.5, is_correct: false, error_type: "incomplete", misconception: null },
          { score: 0.4, is_correct: false, error_type: "incomplete", misconception: null },
        ],
      }),
    );
    expect(d.action).toBe("REVIEW");
  });

  it("CONTINUE is the default and every decision logs its inputs", () => {
    const d = decideNext(
      input({
        topic: { id: "t1", title: "X", mastery: 0.7, confidence: 0.5, pattern: "consistent_success", importance: 3 },
        recent: [{ score: 1, is_correct: true, error_type: null, misconception: null }],
      }),
    );
    expect(d.action).toBe("CONTINUE");
    expect(d.inputs).toMatchObject({ mastery: 0.7, recent_count: 1 });
    expect(d.reason.length).toBeGreaterThan(10);
  });
});
