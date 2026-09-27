import { describe, expect, it } from "vitest";
import { containsGradePromise } from "@/lib/ai/tasks/assessment";
import { checkKnowledgeMap, verifyKnowledgeMap, type KnowledgeMapOutput } from "@/lib/ai/tasks/knowledge-map";
import { diagnosticQuestionCount } from "@/lib/ai/tasks/questions";
import { similarity, tooSimilar } from "@/lib/ai/tasks/topic-context";
import { quoteOccursIn } from "@/lib/ai/material-context";

const material = { id: "m1", category: "planning", type: "text", filename: "plan.md", text: "Förklara skillnaden mellan  väder och klimat.\nAlbedo kommer på provet." };

const topic = (over: Partial<KnowledgeMapOutput["topics"][number]>): KnowledgeMapOutput["topics"][number] => ({
  key: "k",
  title: "T",
  description: "d",
  parent_key: null,
  importance: 3,
  difficulty: 2,
  prerequisites: [],
  required_skills: [],
  likely_question_types: [],
  evidence_type: "explicit",
  inference_reason: null,
  source_evidence: [],
  assessment_dimension: "understanding",
  ...over,
});

describe("knowledge map verification – the AI may never invent what the teacher said", () => {
  it("quotes are verified against the real material (whitespace/case-insensitive)", () => {
    expect(quoteOccursIn("förklara skillnaden mellan väder och klimat", material.text)).toBe(true);
    expect(quoteOccursIn("Växthuseffekten är viktigast", material.text)).toBe(false);
  });

  it("an explicit topic with an unverifiable quote is downgraded to inferred", () => {
    const map: KnowledgeMapOutput = {
      summary: "",
      has_grading_criteria: false,
      warnings: [],
      topics: [
        topic({ key: "vader", source_evidence: [{ source_material_id: "m1", quote: "skillnaden mellan väder och klimat" }] }),
        topic({ key: "ozon", source_evidence: [{ source_material_id: "m1", quote: "Ozonlagret kommer på provet" }] }),
      ],
    };
    const [a, b] = verifyKnowledgeMap(map, [material]);
    expect(a.evidence_type).toBe("explicit");
    expect(a.source_evidence[0].verified).toBe(true);
    expect(b.evidence_type).toBe("inferred");
    expect(b.inference_reason).toMatch(/kunde inte hittas/);
  });

  it("drops references to unknown materials and unknown prerequisite keys", () => {
    const map: KnowledgeMapOutput = {
      summary: "",
      has_grading_criteria: false,
      warnings: [],
      topics: [topic({ key: "a", prerequisites: ["b", "ghost", "a"], evidence_type: "inferred", inference_reason: "r", source_evidence: [{ source_material_id: "nope", quote: "x" }] }), topic({ key: "b", evidence_type: "inferred", inference_reason: "r" })],
    };
    const [a] = verifyKnowledgeMap(map, [material]);
    expect(a.prerequisites).toEqual(["b"]);
    expect(a.source_evidence).toEqual([]);
  });

  it("semantic checks catch duplicates, missing reasons and unknown sources", () => {
    const problems = checkKnowledgeMap(
      {
        summary: "",
        has_grading_criteria: false,
        warnings: [],
        topics: [topic({ key: "a", evidence_type: "inferred", inference_reason: null }), topic({ key: "a", source_evidence: [{ source_material_id: "zzz", quote: "q" }] })],
      },
      new Set(["m1"]),
    );
    expect(problems.join("\n")).toMatch(/Dubblett/);
    expect(problems.join("\n")).toMatch(/inference_reason/);
    expect(problems.join("\n")).toMatch(/okänt material/);
  });
});

describe("assessment guard – never promise a grade", () => {
  it.each([
    "Du kommer få B på provet.",
    "Du kommer att få betyget C",
    "Ditt betyg blir A",
    "Du har 82 % chans att få A",
  ])("rejects: %s", (t) => expect(containsGradePromise(t)).toBe(true));
  it.each([
    "De här svaren visar just nu huvudsakligen kvaliteter som ligger omkring C.",
    "Underlaget ger stöd för att resonemangen är utvecklade.",
  ])("allows: %s", (t) => expect(containsGradePromise(t)).toBe(false));
});

describe("question generation helpers", () => {
  it("diagnostic has 8–15 questions depending on the number of topics", () => {
    expect(diagnosticQuestionCount([{ importance: 3 }])).toBe(8);
    expect(diagnosticQuestionCount(Array.from({ length: 12 }, () => ({ importance: 5 })))).toBe(15);
  });
  it("detects re-used questions", () => {
    expect(similarity("Förklara växthuseffekten med egna ord", "Förklara växthuseffekten med egna ord.")).toBe(1);
    expect(tooSimilar("Vad är albedo?", ["Förklara hur en ekvation löses"])).toBeNull();
  });
});
