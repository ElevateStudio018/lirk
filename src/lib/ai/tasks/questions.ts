import "server-only";

import { z } from "zod";
import {
  ExplainQuestion,
  FindErrorQuestion,
  MatchConceptsQuestion,
  McqQuestion,
  normalizeQuestion,
  NumericQuestion,
  OrderStepsQuestion,
  questionProblems,
  ReasoningQuestion,
  ShortAnswerQuestion,
  StepByStepQuestion,
  type Question,
  type QuestionType,
} from "@/lib/domain/questions";
import { getSubjectProfile } from "@/lib/domain/subjects";
import { generateStructured, STUDENT_VOICE, UNTRUSTED_MATERIAL_RULE } from "../client";
import { topicsBlock, tooSimilar, type PromptTopic } from "./topic-context";

const VARIANTS = {
  mcq: McqQuestion,
  short_answer: ShortAnswerQuestion,
  numeric: NumericQuestion,
  step_by_step: StepByStepQuestion,
  explain: ExplainQuestion,
  reasoning: ReasoningQuestion,
  find_the_error: FindErrorQuestion,
  order_steps: OrderStepsQuestion,
  match_concepts: MatchConceptsQuestion,
} as const;

/** Builds a question-list schema restricted to the given types (smaller schema = better output). */
function questionListSchema(types: QuestionType[]) {
  const variants = types.map((t) => VARIANTS[t]);
  const item =
    variants.length === 1
      ? variants[0]
      : z.discriminatedUnion("type", variants as unknown as [typeof McqQuestion, typeof ShortAnswerQuestion]);
  return z.object({ questions: z.array(item as unknown as z.ZodType<Question>) });
}

const QUESTION_RULES = `Regler för frågor:
- Varje fråga testar exakt ett område (topic_key).
- Flervalsfrågor: 3–4 rimliga alternativ där felen motsvarar vanliga missuppfattningar. Ange missuppfattningen i misconception_by_option.
- Beräkningsfrågor (numeric): entydigt numeriskt svar. Ange tolerance (0 för heltal, annars rimlig avrundning).
- Öppna frågor: key_points och rubric ska göra det möjligt att rätta rättvist.
- find_the_error: en lösning där exakt ett steg innehåller ett typiskt elevfel.
- order_steps: stegen anges i korrekt ordning. match_concepts: korrekta par.
- Anpassa språk och svårighet till elevens nivå. Inga kuggfrågor.`;

function checkQuestions(qs: Question[], validKeys: Set<string>, avoid: string[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const q of qs) {
    if (ids.has(q.id)) problems.push(`Dubblett av id ${q.id}`);
    ids.add(q.id);
    if (!validKeys.has(q.topic_key)) problems.push(`${q.id}: okänd topic_key "${q.topic_key}"`);
    problems.push(...questionProblems(q));
    const dup = tooSimilar(q.prompt, avoid);
    if (dup) problems.push(`${q.id}: för lik en tidigare fråga ("${dup.slice(0, 80)}")`);
  }
  return problems;
}

export function diagnosticQuestionCount(topics: Array<{ importance: number }>) {
  const important = topics.filter((t) => t.importance >= 4).length;
  return Math.min(15, Math.max(8, topics.length + important));
}

export async function generateDiagnostic(input: { subject: string; title: string; topics: PromptTopic[] }) {
  const profile = getSubjectProfile(input.subject);
  const count = diagnosticQuestionCount(input.topics);
  const types: QuestionType[] =
    profile.family === "math" ? ["mcq", "short_answer", "numeric", "explain", "reasoning"] : ["mcq", "short_answer", "explain", "reasoning", "numeric"];
  const keys = new Set(input.topics.map((t) => t.key));
  const important = input.topics.filter((t) => t.importance >= 4).map((t) => t.key);

  const result = await generateStructured({
    name: "diagnostic_test",
    schema: questionListSchema(types),
    tier: "smart",
    system: `Du konstruerar ett kort diagnostiskt test i ${input.subject}. Målet är INTE betyg utan att snabbt uppskatta vad eleven redan kan.
${profile.assessmentStyle}
- Skapa exakt ${count} frågor.
- Täck alla områden minst en gång.
- Områden med viktighet 4–5 testas med minst TVÅ frågor av OLIKA typ (t.ex. flerval + förklara), så att ett enskilt fel inte räcker för en slutsats.
- Blanda frågetyper: flerval, kort svar, beräkning (numeric) där ämnet har beräkningar, förklara, resonemang.
- Börja lätt och öka svårigheten.
${QUESTION_RULES}
${UNTRUSTED_MATERIAL_RULE}
${STUDENT_VOICE}`,
    user: `Prov: ${input.title}\n\nKunskapsområden:\n${topicsBlock(input.topics)}`,
    validate: (v) => {
      const problems = checkQuestions(v.questions, keys, []);
      if (v.questions.length < 8 || v.questions.length > 15) problems.push(`Antal frågor ska vara ${count}, fick ${v.questions.length}`);
      const covered = new Set(v.questions.map((q) => q.topic_key));
      const missing = [...keys].filter((k) => !covered.has(k));
      if (missing.length) problems.push(`Områden utan fråga: ${missing.join(", ")}`);
      const thin = important.filter((k) => v.questions.filter((q) => q.topic_key === k).length < 2);
      if (thin.length && v.questions.length < 15) problems.push(`Viktiga områden med färre än två frågor: ${thin.join(", ")}`);
      return problems;
    },
  });
  return result.questions.map(normalizeQuestion);
}

export type ExercisePurpose = "practice" | "review" | "easier" | "harder" | "remediation" | "confirmation";

const PURPOSE_TEXT: Record<ExercisePurpose, string> = {
  practice: "Aktiv återkallning direkt efter lektionen. Blanda lätta och medelsvåra frågor.",
  review: "Repetition av något eleven lärt sig tidigare. Blanda frågetyper, fokus på att minnas och använda.",
  easier: "Enklare frågor som bygger upp förkunskapen steg för steg. Svårighet 1.",
  harder: "Svårare frågor som kräver tillämpning, flera steg eller resonemang. Svårighet 3.",
  remediation: "Riktad träning på en specifik svaghet från övningsprovet.",
  confirmation: "En kontrollfråga som visar om svagheten är åtgärdad. Ny formulering, samma kunskap.",
};

export async function generateExercises(input: {
  subject: string;
  topic: PromptTopic;
  count: number;
  purpose: ExercisePurpose;
  focus: string | null;
  lessonSummary: string | null;
  avoidPrompts: string[];
}) {
  const profile = getSubjectProfile(input.subject);
  const types: QuestionType[] =
    profile.family === "math"
      ? ["numeric", "step_by_step", "mcq", "find_the_error", "order_steps", "explain"]
      : ["mcq", "short_answer", "explain", "match_concepts", "order_steps", "find_the_error", "reasoning"];
  const keys = new Set([input.topic.key]);

  const result = await generateStructured({
    name: "exercise_set",
    schema: questionListSchema(types),
    tier: "fast",
    system: `Du skapar övningar i ${input.subject} för ett kunskapsområde.
Syfte: ${PURPOSE_TEXT[input.purpose]}
${input.focus ? `Särskilt fokus: ${input.focus}` : ""}
- Skapa exakt ${input.count} frågor, alla med topic_key "${input.topic.key}".
- ${input.count >= 3 ? "Använd minst två olika frågetyper." : "Välj den frågetyp som bäst testar kunskapen."}
- Frågorna ska vara nya – återanvänd inte tidigare frågor.
${QUESTION_RULES}
${STUDENT_VOICE}`,
    user: `Område:\n${topicsBlock([input.topic])}
${input.lessonSummary ? `\nDet här tog lektionen upp:\n${input.lessonSummary}` : ""}
${input.avoidPrompts.length ? `\nTidigare frågor (återanvänd inte):\n- ${input.avoidPrompts.slice(-20).join("\n- ")}` : ""}`,
    validate: (v) => {
      const problems = checkQuestions(v.questions, keys, input.avoidPrompts);
      if (v.questions.length !== input.count) problems.push(`Skapa exakt ${input.count} frågor (fick ${v.questions.length})`);
      return problems;
    },
  });
  return result.questions.map(normalizeQuestion);
}

export { questionListSchema, checkQuestions };
