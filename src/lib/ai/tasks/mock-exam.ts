import "server-only";

import { z } from "zod";
import { normalizeQuestion, type Question, type QuestionType } from "@/lib/domain/questions";
import { getSubjectProfile } from "@/lib/domain/subjects";
import { generateStructured, STUDENT_VOICE, UNTRUSTED_MATERIAL_RULE } from "../client";
import { materialsBlock, type PromptMaterial } from "../material-context";
import { checkQuestions, questionListSchema } from "./questions";
import { topicsBlock, type PromptTopic } from "./topic-context";

const EXAM_TYPES: QuestionType[] = ["mcq", "short_answer", "numeric", "step_by_step", "explain", "reasoning"];

export async function generateMockExam(input: {
  subject: string;
  title: string;
  kind: "mock1" | "final";
  timeLimitMinutes: number;
  topics: Array<PromptTopic & { mastery: number | null }>;
  materials: PromptMaterial[];
  avoidPrompts: string[];
}) {
  const profile = getSubjectProfile(input.subject);
  const keys = new Set(input.topics.map((t) => t.key));
  const questionCount = Math.min(14, Math.max(6, Math.round(input.timeLimitMinutes / 3)));
  const base = questionListSchema(EXAM_TYPES);
  const schema = z.object({
    instructions: z.string().describe("Kort provinstruktion till eleven"),
    questions: z.array(
      z.object({
        question: base.shape.questions.element,
        points: z.number().int().min(1).max(6),
        source_material_ids: z.array(z.string()).describe("Vilket material frågan bygger på"),
      }),
    ),
  });

  const result = await generateStructured({
    name: "mock_exam",
    schema,
    tier: "smart",
    system: `Du konstruerar ett ${input.kind === "mock1" ? "första övningsprov" : "slutprov (sista övningsprovet)"} i ${input.subject} som ska likna ett riktigt prov i svensk skola så mycket som möjligt.
${profile.assessmentStyle}
- ${questionCount} frågor, total skrivtid ${input.timeLimitMinutes} minuter.
- Fördela frågorna efter viktighet: viktiga områden får fler och tyngre frågor. Alla viktiga områden (4–5) ska finnas med.
- Blanda nivåer: några frågor som alla bör klara, flera medel, några som kräver utvecklade resonemang/flerstegslösningar.
- Poäng (points) speglar hur mycket frågan kräver.
- Om underlaget innehåller betygskriterier: utforma öppna frågor så att svaren kan visa olika kvalitetsnivåer.
- Använd underlagets innehåll, exempel och begrepp. Ange source_material_ids.
- Alla frågor måste vara NYA och skilja sig från tidigare frågor eleven sett.
- Ingen hjälp, inga ledtrådar i frågetexten.
${UNTRUSTED_MATERIAL_RULE}
${STUDENT_VOICE}`,
    user: `Prov: ${input.title}

Kunskapsområden (med elevens nuvarande uppskattade kunskap):
${topicsBlock(input.topics)}
${input.topics.map((t) => `- ${t.key}: ${t.mastery === null ? "okänd" : `${Math.round(t.mastery * 100)} %`}`).join("\n")}

${materialsBlock(input.materials, 60_000)}

${input.avoidPrompts.length ? `Frågor eleven redan sett (får INTE återanvändas):\n- ${input.avoidPrompts.slice(-60).join("\n- ")}` : ""}`,
    validate: (v) => {
      const qs = v.questions.map((x) => x.question as Question);
      const problems = checkQuestions(qs, keys, input.avoidPrompts);
      if (qs.length < 5) problems.push("För få frågor");
      const important = input.topics.filter((t) => t.importance >= 4).map((t) => t.key);
      const missing = important.filter((k) => !qs.some((q) => q.topic_key === k));
      if (missing.length) problems.push(`Viktiga områden saknas i provet: ${missing.join(", ")}`);
      if (qs.every((q) => q.type === "mcq")) problems.push("Provet får inte bara bestå av flervalsfrågor");
      return problems;
    },
  });

  const materialIds = new Set(input.materials.map((m) => m.id));
  return {
    instructions: result.instructions,
    questions: result.questions.map((x) => ({
      question: normalizeQuestion(x.question as Question),
      points: x.points,
      source_material_ids: x.source_material_ids.filter((id) => materialIds.has(id)),
    })),
  };
}
