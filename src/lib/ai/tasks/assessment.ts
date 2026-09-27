import "server-only";

import { z } from "zod";
import { correctAnswerText } from "@/lib/engine/grading";
import type { Question } from "@/lib/domain/questions";
import { generateStructured, STUDENT_VOICE, UNTRUSTED_MATERIAL_RULE } from "../client";
import { materialsBlock, type PromptMaterial } from "../material-context";

export const DIMENSIONS = ["correctness", "understanding", "method", "reasoning", "terminology", "completeness"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  correctness: "Korrekthet",
  understanding: "Förståelse",
  method: "Metod",
  reasoning: "Resonemang",
  terminology: "Begrepp",
  completeness: "Fullständighet",
};

const Level = z.enum(["strong", "ok", "weak", "missing", "not_applicable"]);
export type Level = z.infer<typeof Level>;

const DimensionAssessment = z.object({ level: Level, comment: z.string().describe("Kort och konkret, eller tom sträng") });

export const QuestionAssessment = z.object({
  question_id: z.string(),
  score_fraction: z.number().min(0).max(1).describe("Andel av frågans poäng som svaret förtjänar"),
  correctness: DimensionAssessment,
  understanding: DimensionAssessment,
  method: DimensionAssessment,
  reasoning: DimensionAssessment,
  terminology: DimensionAssessment,
  completeness: DimensionAssessment,
  misconceptions: z.array(z.string()),
  feedback: z.string().describe("2–4 meningar: vad som var bra och exakt vad som saknas för ett starkare svar"),
  source_refs: z
    .array(z.object({ source_material_id: z.string(), why: z.string() }))
    .describe("Vilka delar av elevens underlag feedbacken bygger på"),
});
export type QuestionAssessment = z.infer<typeof QuestionAssessment>;

export const AssessmentOutput = z.object({
  per_question: z.array(QuestionAssessment),
  strengths: z.array(z.string()).min(1).max(5).describe("Det här gör du bra"),
  holding_back: z.array(z.string()).min(1).max(5).describe("Det här håller dig tillbaka"),
  top_fixes: z
    .array(z.object({ title: z.string(), description: z.string(), topic_key: z.string().nullable() }))
    .min(1)
    .max(3)
    .describe("De tre viktigaste sakerna att fixa, viktigast först"),
  criteria_statement: z
    .string()
    .describe(
      "Hur svaren förhåller sig till betygskriterierna. ALDRIG 'du kommer få X'. Använd t.ex. 'De här svaren visar just nu huvudsakligen kvaliteter som ligger omkring…' eller 'Underlaget ger stöd för…'.",
    ),
  remediation_targets: z
    .array(
      z.object({
        topic_key: z.string().nullable(),
        title: z.string().describe("Kort, konkret: t.ex. 'Resonemangen saknar mellanled'"),
        description: z.string(),
        priority: z.number().int().min(1).max(5).describe("5 = störst betydelse för provresultatet"),
      }),
    )
    .min(1)
    .max(5),
});
export type AssessmentOutput = z.infer<typeof AssessmentOutput>;

/** Sentences that promise a grade are never allowed. */
const GRADE_PROMISE = /(du\s+(kommer\s+(att\s+)?)?(få|få\s+betyget|ha)\s+(betyget\s+)?[A-F]\b)|(ditt\s+betyg\s+(blir|är|kommer)\b)|(\bgaranterat\b)|(\d+\s*%\s*chans)/i;

export function containsGradePromise(text: string) {
  return GRADE_PROMISE.test(text);
}

export const NO_CRITERIA_STATEMENT =
  "Ditt underlag innehåller inga betygskriterier, så bedömningen kan inte kopplas till betygsstegen. Analysen bygger på ämnets innehåll och hur fullständiga, korrekta och välmotiverade svaren är.";

export type AssessedQuestion = {
  id: string;
  question: Question;
  points: number;
  topicTitle: string;
  answerText: string;
  deterministicScore: number | null;
};

export async function assessMockExam(input: {
  subject: string;
  examTitle: string;
  targetGrade: string | null;
  criteria: PromptMaterial[];
  otherMaterials: PromptMaterial[];
  questions: AssessedQuestion[];
}) {
  const hasCriteria = input.criteria.length > 0;
  const ids = new Set(input.questions.map((q) => q.id));
  const materialIds = new Set([...input.criteria, ...input.otherMaterials].map((m) => m.id));
  const validTopicKeys = new Set(input.questions.map((q) => q.question.topic_key));

  const result = await generateStructured({
    name: "mock_exam_assessment",
    schema: AssessmentOutput,
    tier: "smart",
    system: `Du är en noggrann och rättvis svensk lärare som bedömer ett övningsprov i ${input.subject}.
Analysera varje svar i sex dimensioner: korrekthet, förståelse, metod, resonemang, begreppsanvändning och fullständighet (not_applicable om dimensionen inte är relevant för frågan).
Koppla feedbacken till elevens eget underlag via source_refs.
${hasCriteria
  ? `Betygskriterier finns i underlaget. Använd dem för criteria_statement. Formulera dig försiktigt: beskriv vilka kvaliteter svaren visar, t.ex. "De här svaren visar just nu huvudsakligen kvaliteter som ligger omkring…" eller "Underlaget ger stöd för…". Skriv aldrig att eleven kommer att få ett visst betyg.`
  : `Det finns INGA betygskriterier i underlaget. criteria_statement ska tydligt säga att bedömningen därför inte kan kopplas till betygssteg.`}
- För frågor med fast rätt svar (deterministic_score angiven) är poängen redan bestämd – sätt score_fraction till den och kommentera bara metod/förståelse.
- remediation_targets: 3–5 svagheter med störst betydelse, konkreta och åtgärdbara.
- top_fixes: exakt de tre viktigaste sakerna, viktigast först.
${UNTRUSTED_MATERIAL_RULE}
${STUDENT_VOICE}`,
    user: `Prov: ${input.examTitle}
${input.targetGrade ? `Elevens målbetyg: ${input.targetGrade}` : ""}

${hasCriteria ? `Betygskriterier:\n${materialsBlock(input.criteria, 25_000)}` : "Betygskriterier: saknas"}

Övrigt underlag:
${materialsBlock(input.otherMaterials, 35_000)}

Elevens svar:
${input.questions
  .map(
    (q) => `<fråga id="${q.id}" poäng="${q.points}" område="${q.topicTitle}" typ="${q.question.type}"${
      q.deterministicScore !== null ? ` deterministic_score="${q.deterministicScore}"` : ""
    }>
${q.question.prompt}
Facit/riktlinje: ${correctAnswerText(q.question)}
<elevens_svar>${q.answerText.slice(0, 4000) || "(inget svar)"}</elevens_svar>
</fråga>`,
  )
  .join("\n")}`,
    validate: (v) => {
      const problems: string[] = [];
      const seen = new Set(v.per_question.map((p) => p.question_id));
      const missing = [...ids].filter((id) => !seen.has(id));
      if (missing.length) problems.push(`Bedömning saknas för frågor: ${missing.join(", ")}`);
      const texts = [v.criteria_statement, ...v.strengths, ...v.holding_back, ...v.per_question.map((p) => p.feedback)];
      if (texts.some(containsGradePromise))
        problems.push("Texten lovar eller förutsäger ett betyg. Formulera om enligt instruktionen.");
      if (v.top_fixes.length !== 3 && input.questions.length >= 3) problems.push("top_fixes ska ha exakt tre punkter");
      return problems;
    },
  });

  return {
    ...result,
    criteria_statement: hasCriteria ? result.criteria_statement : NO_CRITERIA_STATEMENT,
    per_question: result.per_question
      .filter((p) => ids.has(p.question_id))
      .map((p) => ({ ...p, source_refs: p.source_refs.filter((r) => materialIds.has(r.source_material_id)) })),
    top_fixes: result.top_fixes.map((f) => ({ ...f, topic_key: f.topic_key && validTopicKeys.has(f.topic_key) ? f.topic_key : null })),
    remediation_targets: result.remediation_targets.slice(0, 5),
  };
}
