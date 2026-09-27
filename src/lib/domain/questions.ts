import { z } from "zod";

/**
 * One question schema shared by the diagnostic test, exercises and mock exams.
 * Every variant carries its own answer key so deterministic grading is possible
 * wherever the question type allows it. The schema is also used as the OpenAI
 * Structured Output schema, so all fields are required (nullable instead of optional).
 */

export const ASSESSMENT_DIMENSIONS = [
  "recall",
  "understanding",
  "application",
  "reasoning",
  "analysis",
  "problem_solving",
] as const;
export const AssessmentDimension = z.enum(ASSESSMENT_DIMENSIONS);
export type AssessmentDimension = z.infer<typeof AssessmentDimension>;

const base = {
  id: z.string().describe("Kort unikt id, t.ex. q1"),
  topic_key: z.string().describe("key för kunskapsområdet frågan testar"),
  prompt: z.string().describe("Frågetexten som eleven ser"),
  difficulty: z.number().int().min(1).max(3).describe("1 = lätt, 2 = medel, 3 = svår"),
  dimension: AssessmentDimension,
};

export const McqQuestion = z.object({
  type: z.literal("mcq"),
  ...base,
  options: z.array(z.string()).min(2).max(5),
  correct_index: z.number().int().min(0),
  explanation: z.string().describe("Varför rätt svar är rätt"),
  misconception_by_option: z
    .array(z.string().nullable())
    .describe("Samma längd som options. Vilken missuppfattning ett felaktigt alternativ avslöjar, annars null"),
});

export const ShortAnswerQuestion = z.object({
  type: z.literal("short_answer"),
  ...base,
  expected_answer: z.string(),
  accepted_answers: z.array(z.string()).describe("Korta varianter som ska räknas som helt rätt"),
  rubric: z.string(),
});

export const NumericQuestion = z.object({
  type: z.literal("numeric"),
  ...base,
  answer_value: z.number(),
  tolerance: z.number().min(0).describe("Tillåten absolut avvikelse, 0 för exakt"),
  unit: z.string().nullable(),
  worked_solution: z.array(z.string()).describe("Lösningssteg"),
});

export const StepByStepQuestion = z.object({
  type: z.literal("step_by_step"),
  ...base,
  expected_steps: z.array(z.string()).min(2),
  final_answer: z.string(),
  rubric: z.string(),
});

export const ExplainQuestion = z.object({
  type: z.literal("explain"),
  ...base,
  key_points: z.array(z.string()).min(1),
  rubric: z.string(),
});

export const ReasoningQuestion = z.object({
  type: z.literal("reasoning"),
  ...base,
  key_points: z.array(z.string()).min(1),
  rubric: z.string(),
});

export const FindErrorQuestion = z.object({
  type: z.literal("find_the_error"),
  ...base,
  steps: z.array(z.string()).min(2).describe("En lösning där exakt ett steg är fel"),
  error_step_index: z.number().int().min(0),
  correction: z.string(),
  explanation: z.string(),
});

export const OrderStepsQuestion = z.object({
  type: z.literal("order_steps"),
  ...base,
  steps: z.array(z.string()).min(3).max(7).describe("Stegen i KORREKT ordning; appen blandar dem"),
  explanation: z.string(),
});

export const MatchConceptsQuestion = z.object({
  type: z.literal("match_concepts"),
  ...base,
  pairs: z
    .array(z.object({ left: z.string(), right: z.string() }))
    .min(3)
    .max(6)
    .describe("Korrekta par; appen blandar högerkolumnen"),
  explanation: z.string(),
});

export const Question = z.discriminatedUnion("type", [
  McqQuestion,
  ShortAnswerQuestion,
  NumericQuestion,
  StepByStepQuestion,
  ExplainQuestion,
  ReasoningQuestion,
  FindErrorQuestion,
  OrderStepsQuestion,
  MatchConceptsQuestion,
]);
export type Question = z.infer<typeof Question>;
export type QuestionType = Question["type"];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Flerval",
  short_answer: "Kort svar",
  numeric: "Beräkning",
  step_by_step: "Steg för steg",
  explain: "Förklara med egna ord",
  reasoning: "Resonemang",
  find_the_error: "Hitta felet",
  order_steps: "Sätt i ordning",
  match_concepts: "Para ihop",
};

/** Question types graded without AI. */
export const DETERMINISTIC_TYPES: ReadonlySet<QuestionType> = new Set([
  "mcq",
  "numeric",
  "order_steps",
  "match_concepts",
  "find_the_error",
]);

/** Answer payloads sent from the client. */
export const Answer = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), choice: z.number().int().min(0) }),
  z.object({ kind: z.literal("text"), text: z.string().max(8000) }),
  z.object({ kind: z.literal("error_step"), step: z.number().int().min(0), text: z.string().max(4000) }),
  z.object({ kind: z.literal("order"), order: z.array(z.number().int().min(0)).max(10) }),
  z.object({ kind: z.literal("matches"), matches: z.array(z.number().int().min(-1)).max(10) }),
]);
export type Answer = z.infer<typeof Answer>;

export function answerKindFor(type: QuestionType): Answer["kind"] {
  switch (type) {
    case "mcq":
      return "choice";
    case "find_the_error":
      return "error_step";
    case "order_steps":
      return "order";
    case "match_concepts":
      return "matches";
    default:
      return "text";
  }
}

/**
 * Validates internal consistency that JSON Schema cannot express
 * (index bounds, array lengths). Returns a list of problems.
 */
export function questionProblems(q: Question): string[] {
  const problems: string[] = [];
  if (q.type === "mcq") {
    if (q.correct_index >= q.options.length) problems.push(`${q.id}: correct_index utanför options`);
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length)
      problems.push(`${q.id}: dubbletter bland alternativen`);
  }
  if (q.type === "find_the_error" && q.error_step_index >= q.steps.length)
    problems.push(`${q.id}: error_step_index utanför steps`);
  if (q.type === "numeric" && !Number.isFinite(q.answer_value)) problems.push(`${q.id}: ogiltigt svar`);
  if (!q.prompt.trim()) problems.push(`${q.id}: tom fråga`);
  return problems;
}

/** Makes AI-produced questions safe to use (pads/truncates arrays that must align). */
export function normalizeQuestion(q: Question): Question {
  if (q.type === "mcq") {
    const m = q.misconception_by_option.slice(0, q.options.length);
    while (m.length < q.options.length) m.push(null);
    return { ...q, misconception_by_option: m.map((x, i) => (i === q.correct_index ? null : x)) };
  }
  return q;
}

/** Strips answer keys so a question can be sent to the browser before it is answered. */
export type PublicQuestion =
  | { type: "mcq"; id: string; prompt: string; options: string[] }
  | { type: "order_steps"; id: string; prompt: string; steps: string[] }
  | { type: "match_concepts"; id: string; prompt: string; left: string[]; right: string[] }
  | { type: "find_the_error"; id: string; prompt: string; steps: string[] }
  | { type: "numeric"; id: string; prompt: string; unit: string | null }
  | { type: Exclude<QuestionType, "mcq" | "order_steps" | "match_concepts" | "find_the_error" | "numeric">; id: string; prompt: string };

/** Deterministic shuffle so the same question always renders the same way. */
export function seededPermutation(n: number, seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  // Never show an already-sorted order for ordering tasks.
  if (n > 1 && idx.every((v, i) => v === i)) idx.push(idx.shift()!);
  return idx;
}

export function toPublicQuestion(q: Question, seed: string): PublicQuestion {
  switch (q.type) {
    case "mcq":
      return { type: "mcq", id: q.id, prompt: q.prompt, options: q.options };
    case "order_steps": {
      const perm = seededPermutation(q.steps.length, seed + q.id);
      return { type: "order_steps", id: q.id, prompt: q.prompt, steps: perm.map((i) => q.steps[i]) };
    }
    case "match_concepts": {
      const perm = seededPermutation(q.pairs.length, seed + q.id);
      return {
        type: "match_concepts",
        id: q.id,
        prompt: q.prompt,
        left: q.pairs.map((p) => p.left),
        right: perm.map((i) => q.pairs[i].right),
      };
    }
    case "find_the_error":
      return { type: "find_the_error", id: q.id, prompt: q.prompt, steps: q.steps };
    case "numeric":
      return { type: "numeric", id: q.id, prompt: q.prompt, unit: q.unit };
    default:
      return { type: q.type, id: q.id, prompt: q.prompt };
  }
}
