import { describe, expect, it } from "vitest";
import { seededPermutation, toPublicQuestion, type Question } from "@/lib/domain/questions";
import { gradeDeterministic, parseNumber } from "@/lib/engine/grading";

const base = { topic_key: "t", difficulty: 2 as const, dimension: "application" as const };

describe("number parsing", () => {
  it.each([
    ["4", 4],
    ["x = 4", 4],
    ["3,5", 3.5],
    ["−2", -2],
    ["1 200", 1200],
    ["12 cm", 12],
    ["3/4", 0.75],
    ["svar: -7", -7],
  ])("%s → %s", (input, expected) => {
    expect(parseNumber(input)).toBeCloseTo(expected);
  });
  it("returns null without a number", () => expect(parseNumber("vet ej")).toBeNull());
});

describe("deterministic grading", () => {
  it("mcq: names the misconception behind a wrong option", () => {
    const q: Question = {
      ...base,
      type: "mcq",
      id: "q1",
      prompt: "Vad gör växthusgaserna?",
      options: ["Tar upp värmestrålning", "Stoppar solljus", "Skyddar mot UV"],
      correct_index: 0,
      explanation: "De tar upp värmestrålning.",
      misconception_by_option: [null, null, "Blandar ihop med ozonlagret"],
    };
    const r = gradeDeterministic(q, { kind: "choice", choice: 2 }, "seed");
    expect(r.is_correct).toBe(false);
    expect(r.error_type).toBe("misconception");
    expect(r.misconception).toBe("Blandar ihop med ozonlagret");
    expect(gradeDeterministic(q, { kind: "choice", choice: 0 }, "seed").score).toBe(1);
  });

  it("numeric: detects a lost minus sign with concrete feedback", () => {
    const q: Question = { ...base, type: "numeric", id: "q2", prompt: "Lös 2x + 10 = 4", answer_value: -3, tolerance: 0, unit: null, worked_solution: ["2x = -6", "x = -3"] };
    const r = gradeDeterministic(q, { kind: "text", text: "x = 3" }, "s");
    expect(r.is_correct).toBe(false);
    expect(r.error_type).toBe("sign_error");
    expect(r.feedback).toMatch(/minustecken/);
    expect(gradeDeterministic(q, { kind: "text", text: "-3" }, "s").is_correct).toBe(true);
  });

  it("order_steps: grades against the shuffled display order", () => {
    const q: Question = { ...base, type: "order_steps", id: "q3", prompt: "Ordna", steps: ["a", "b", "c", "d"], explanation: "" };
    const pub = toPublicQuestion(q, "set1");
    if (pub.type !== "order_steps") throw new Error();
    // Find the display order that restores the original sequence.
    const correctOrder = ["a", "b", "c", "d"].map((s) => pub.steps.indexOf(s));
    expect(gradeDeterministic(q, { kind: "order", order: correctOrder }, "set1").is_correct).toBe(true);
    const wrong = gradeDeterministic(q, { kind: "order", order: [...correctOrder].reverse() }, "set1");
    expect(wrong.is_correct).toBe(false);
    expect(wrong.score).toBeLessThan(1);
  });

  it("match_concepts: partial credit per correct pair", () => {
    const q: Question = {
      ...base,
      type: "match_concepts",
      id: "q4",
      prompt: "Para ihop",
      pairs: [
        { left: "CO2", right: "Fossila bränslen" },
        { left: "Metan", right: "Kor" },
        { left: "Lustgas", right: "Konstgödsel" },
      ],
      explanation: "",
    };
    const pub = toPublicQuestion(q, "s");
    if (pub.type !== "match_concepts") throw new Error();
    const all = q.pairs.map((p) => pub.right.indexOf(p.right));
    expect(gradeDeterministic(q, { kind: "matches", matches: all }, "s").score).toBe(1);
    const oneWrong = [...all];
    [oneWrong[0], oneWrong[1]] = [oneWrong[1], oneWrong[0]];
    expect(gradeDeterministic(q, { kind: "matches", matches: oneWrong }, "s").score).toBeCloseTo(1 / 3);
  });

  it("find_the_error: correct step index", () => {
    const q: Question = { ...base, type: "find_the_error", id: "q5", prompt: "Hitta felet", steps: ["3x - 5 = 16", "3x = 11", "x = 11/3"], error_step_index: 1, correction: "3x = 21", explanation: "−5 ska bli +5." };
    expect(gradeDeterministic(q, { kind: "error_step", step: 1, text: "" }, "s").is_correct).toBe(true);
    expect(gradeDeterministic(q, { kind: "error_step", step: 2, text: "" }, "s").is_correct).toBe(false);
  });

  it("seeded permutation is deterministic and never the identity", () => {
    expect(seededPermutation(5, "abc")).toEqual(seededPermutation(5, "abc"));
    for (const seed of ["a", "b", "c", "d", "e", "f"]) expect(seededPermutation(4, seed)).not.toEqual([0, 1, 2, 3]);
  });

  it("public questions never contain answer keys", () => {
    const q: Question = { ...base, type: "numeric", id: "q6", prompt: "2+2", answer_value: 4, tolerance: 0, unit: null, worked_solution: ["4"] };
    expect(JSON.stringify(toPublicQuestion(q, "s"))).not.toContain("answer_value");
  });
});
