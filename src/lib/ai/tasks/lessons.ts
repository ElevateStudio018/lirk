import "server-only";

import { getSubjectProfile } from "@/lib/domain/subjects";
import { Lesson, MicroLesson, SCENE_TYPES, validateLesson } from "@/lib/video/schema";
import { generateStructured, STUDENT_VOICE, UNTRUSTED_MATERIAL_RULE } from "../client";
import { topicsBlock, type PromptTopic } from "./topic-context";

const SCENE_GUIDE = `Scentyper (välj den som bäst hjälper förståelsen – aldrig bara text-slides):
- title: öppning. concept: 1–4 nyckelidéer med ikoner. definition: ett begrepp.
- big-number: en siffra som gör något konkret (räknas upp). comparison: två saker sida vid sida.
- timeline: händelser i tid. process: steg i ordning (cyclic om det är ett kretslopp).
- cause-effect: orsakskedja med pilar. equation: algebra rad för rad med markerad ändring.
- graph: linje- eller stapeldiagram (bara med verkliga eller tydligt förenklade värden; ange source_note).
- quote: citat ur underlaget. memory-trick: minnesregel. misconception: vanligt fel vs rätt.
- example: löst exempel steg för steg. summary: sammanfattning. question-transition: fråga som väcker nyfikenhet.
Regler:
- Varje scen: headline kort, narration 1–3 meningar talspråk, duration så att narrationen hinns med.
- emphasis: 1–3 nyckelord som finns ordagrant i scenens text.
- animation: välj det som förklarar bäst (sequential för steg, draw för orsakskedjor, zoom-in för detaljer, pulse för en viktig siffra).
- Hitta inte på siffror eller fakta. Om underlaget inte har data, använd allmänt vedertagna fakta eller förenklade exempel och säg det.
- Matematik: skriv uttryck i klartext (2x + 3 = 11), en omskrivning per rad i equation.`;

export async function generateLesson(input: {
  subject: string;
  topic: PromptTopic;
  kind: "lesson" | "example";
  focus: string | null;
  materialExcerpt: string | null;
}) {
  const profile = getSubjectProfile(input.subject);
  const result = await generateStructured({
    name: "lesson",
    schema: Lesson,
    tier: "smart",
    system: `Du är en prisbelönt pedagog som gör korta, visuella förklaringsvideor för svenska elever i ${input.subject}.
${input.kind === "lesson"
  ? "Gör en lektion på 2–4 minuter (6–10 scener): väck nyfikenhet, förklara kärnan visuellt, visa ett exempel, ta upp en vanlig missuppfattning, sammanfatta."
  : "Gör en genomgång av 2–3 lösta exempel (4–7 scener) med ökande svårighet. Använd example- och equation-scener för beräkningar, process/cause-effect för resonemang."}
Lägg in ${input.kind === "lesson" ? "2" : "1"} checkpoints (flervalsfrågor) efter viktiga scener. Varje checkpoint har en kort mikrolektion (remedy_scenes, 1–3 scener) som rättar missuppfattningen bakom de felaktiga alternativen.
${profile.family === "math" ? "Ämnet är matematik: visa räkneregler med equation-scener och lösta exempel." : ""}
${SCENE_GUIDE}
Tillåtna scentyper: ${SCENE_TYPES.join(", ")}.
${UNTRUSTED_MATERIAL_RULE}
${STUDENT_VOICE}`,
    user: `Område:\n${topicsBlock([input.topic])}
${input.focus ? `\nFokus: ${input.focus}` : ""}
${input.materialExcerpt ? `\nUtdrag ur elevens underlag:\n<material>\n${input.materialExcerpt.slice(0, 12000)}\n</material>` : ""}`,
    validate: (v) => validateLesson(v).problems,
  });
  return validateLesson(result).lesson;
}

export async function generateMicroLesson(input: {
  subject: string;
  topic: PromptTopic;
  mode: "misconception" | "easier_example";
  focus: string;
}) {
  const result = await generateStructured({
    name: "micro_lesson",
    schema: MicroLesson,
    tier: "fast",
    system: `Du gör en mycket kort visuell mikrolektion (2–4 scener, under en minut) i ${input.subject}.
${input.mode === "misconception"
  ? "Eleven har visat en specifik missuppfattning. Börja med en misconception-scen (fel vs rätt och varför), visa sedan ett konkret exempel, avsluta med en minnesregel eller sammanfattning."
  : "Eleven saknar en förkunskap. Visa ett enklare, fullständigt löst exempel steg för steg och koppla det till området."}
${SCENE_GUIDE}
${STUDENT_VOICE}`,
    user: `Område:\n${topicsBlock([input.topic])}\n\nFokus: ${input.focus}`,
  });
  return { ...result, scenes: validateLesson({ title: result.title, scenes: result.scenes, checkpoints: [] }).lesson.scenes };
}
