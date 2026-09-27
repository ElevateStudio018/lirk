import "server-only";

import { z } from "zod";
import { AssessmentDimension } from "@/lib/domain/questions";
import { generateStructured, STUDENT_VOICE, UNTRUSTED_MATERIAL_RULE } from "../client";
import { materialsBlock, quoteOccursIn, type PromptMaterial } from "../material-context";

export const KnowledgeMapOutput = z.object({
  summary: z.string().describe("2–3 meningar till eleven om vad provet verkar handla om"),
  has_grading_criteria: z.boolean().describe("true bara om materialet innehåller betygskriterier/kunskapskrav"),
  topics: z
    .array(
      z.object({
        key: z.string().describe("Kort unikt id i snake_case, t.ex. vaxthuseffekten"),
        title: z.string().describe("Elevvänligt namn, 1–4 ord"),
        description: z.string().describe("Vad eleven behöver kunna, 1–2 meningar, konkret"),
        parent_key: z.string().nullable().describe("key för ett överordnat område, annars null"),
        importance: z.number().int().min(1).max(5),
        difficulty: z.number().int().min(1).max(5),
        prerequisites: z.array(z.string()).describe("keys för områden som måste förstås först"),
        required_skills: z.array(z.string()).describe("Konkreta förmågor, t.ex. 'förklara hur…', 'lösa ekvationer med…'"),
        likely_question_types: z.array(z.string()).describe("T.ex. 'förklara begrepp', 'beräkning', 'resonemang om orsaker'"),
        evidence_type: z.enum(["explicit", "inferred"]),
        inference_reason: z
          .string()
          .nullable()
          .describe("Krävs när evidence_type = inferred: varför du tror att detta krävs"),
        source_evidence: z
          .array(
            z.object({
              source_material_id: z.string(),
              quote: z.string().describe("ORDAGRANT citat från materialet (max ca 200 tecken)"),
            }),
          )
          .describe("Citat som stöder området. Tom lista om det är helt härlett."),
        assessment_dimension: AssessmentDimension,
      }),
    )
    .min(2)
    .max(20),
  warnings: z.array(z.string()).describe("T.ex. 'Underlaget nämner inte vilka kapitel som ingår'"),
});
export type KnowledgeMapOutput = z.infer<typeof KnowledgeMapOutput>;

export type VerifiedEvidence = { source_material_id: string; quote: string; verified: boolean };

export type KnowledgeMapTopic = Omit<KnowledgeMapOutput["topics"][number], "source_evidence"> & {
  source_evidence: VerifiedEvidence[];
};

export function checkKnowledgeMap(map: KnowledgeMapOutput, materialIds: Set<string>): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  for (const t of map.topics) {
    if (keys.has(t.key)) problems.push(`Dubblett av key "${t.key}"`);
    keys.add(t.key);
    if (t.evidence_type === "inferred" && !t.inference_reason?.trim())
      problems.push(`"${t.key}" är inferred men saknar inference_reason`);
    if (t.evidence_type === "explicit" && t.source_evidence.length === 0)
      problems.push(`"${t.key}" är explicit men saknar source_evidence`);
    for (const e of t.source_evidence)
      if (!materialIds.has(e.source_material_id)) problems.push(`"${t.key}" hänvisar till okänt material ${e.source_material_id}`);
  }
  return problems;
}

/**
 * Makes the AI output trustworthy:
 *  - unknown keys in parent/prerequisites are removed, self-references dropped
 *  - every quote is checked against the real material text
 *  - an "explicit" topic without a single verified quote is downgraded to "inferred"
 */
export function verifyKnowledgeMap(map: KnowledgeMapOutput, materials: PromptMaterial[]): KnowledgeMapTopic[] {
  const byId = new Map(materials.map((m) => [m.id, m]));
  const keys = new Set(map.topics.map((t) => t.key));
  return map.topics.map((t) => {
    const evidence = t.source_evidence
      .filter((e) => byId.has(e.source_material_id))
      .map((e) => ({ ...e, verified: quoteOccursIn(e.quote, byId.get(e.source_material_id)!.text) }));
    const hasVerified = evidence.some((e) => e.verified);
    const downgraded = t.evidence_type === "explicit" && !hasVerified;
    return {
      ...t,
      parent_key: t.parent_key && keys.has(t.parent_key) && t.parent_key !== t.key ? t.parent_key : null,
      prerequisites: [...new Set(t.prerequisites.filter((p) => keys.has(p) && p !== t.key))],
      importance: Math.min(5, Math.max(1, t.importance)),
      difficulty: Math.min(5, Math.max(1, t.difficulty)),
      evidence_type: downgraded ? "inferred" : t.evidence_type,
      inference_reason: downgraded
        ? `Citatet som AI:n angav kunde inte hittas ordagrant i underlaget, så området räknas som en slutsats. ${t.inference_reason ?? ""}`.trim()
        : t.inference_reason,
      source_evidence: evidence,
    };
  });
}

export async function buildKnowledgeMap(input: {
  subject: string;
  title: string;
  targetGrade: string | null;
  materials: PromptMaterial[];
}) {
  const materialIds = new Set(input.materials.map((m) => m.id));
  const output = await generateStructured({
    name: "knowledge_map",
    schema: KnowledgeMapOutput,
    tier: "smart",
    system: `Du är en erfaren svensk ämneslärare och provkonstruktör.
Du ska analysera elevens kursunderlag och skapa en strukturerad kunskapskarta: exakt vad eleven förväntas kunna till provet.

Regler:
- EXPLICIT: materialet säger uttryckligen att detta ingår/ska kunnas. Ange då ordagranna citat i source_evidence.
- INFERRED: din bedömning att det sannolikt krävs (t.ex. förkunskap eller typiskt för ämnet). Förklara varför i inference_reason.
- Uppfinn aldrig vad läraren sagt. Citat måste vara ordagranna ur materialet.
- Material i kategorin "Det här har läraren sagt kommer på provet" väger tyngst för importance.
- 4–14 områden brukar vara lagom. Hellre konkreta områden än breda rubriker.
- importance 5 = centralt för provet, 1 = perifert. difficulty 5 = svårt för en elev i den här årskursen.
- has_grading_criteria = true endast om betygskriterier/kunskapskrav faktiskt finns i materialet.
${UNTRUSTED_MATERIAL_RULE}
${STUDENT_VOICE}`,
    user: `Ämne: ${input.subject}
Prov: ${input.title}
${input.targetGrade ? `Elevens målbetyg: ${input.targetGrade}` : "Eleven har inte angett målbetyg."}

${materialsBlock(input.materials)}`,
    validate: (v) => checkKnowledgeMap(v, materialIds),
  });
  return { ...output, topics: verifyKnowledgeMap(output, input.materials) };
}
