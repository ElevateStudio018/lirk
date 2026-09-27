/**
 * Deterministic stand-in for the LLM in end-to-end tests.
 *
 * Every response is pushed through the *production* zod schema and semantic
 * validator of the request (exactly what lib/ai/client does with real model
 * output), so a fixture that the app would reject makes the test fail.
 */
import type { z } from "zod";
import type { StructuredRequest } from "@/lib/ai/client";
import { equationsLesson } from "@/lib/video/samples/equations";
import { greenhouseLesson } from "@/lib/video/samples/greenhouse";

export const calls: Array<{ name: string; system: string; user: string }> = [];

type TopicFixture = {
  key: string;
  title: string;
  importance: number;
  difficulty: number;
  prerequisites: string[];
  evidence: Array<[category: string, quote: string]>;
  evidence_type: "explicit" | "inferred";
  dimension: string;
};

const CATEGORY = {
  planning: "Lärarens planering",
  criteria: "Betygskriterier / kunskapskrav",
  notes: "Anteckningar / genomgång",
  teacher_said: "Det här har läraren sagt kommer på provet",
};

export const GEOGRAPHY_TOPICS: TopicFixture[] = [
  { key: "vader_klimat", title: "Väder och klimat", importance: 5, difficulty: 1, prerequisites: [], evidence_type: "explicit", dimension: "understanding", evidence: [["planning", "Förklara skillnaden mellan **väder** och **klimat**."], ["teacher_said", "Ni MÅSTE kunna skillnaden mellan väder och klimat"]] },
  { key: "vaxthuseffekten", title: "Växthuseffekten", importance: 5, difficulty: 3, prerequisites: [], evidence_type: "explicit", dimension: "understanding", evidence: [["notes", "Växthusgaser tar upp en del av värmestrålningen och sänder den tillbaka åt alla håll"]] },
  { key: "vaxthusgaser", title: "Växthusgaser och källor", importance: 4, difficulty: 2, prerequisites: [], evidence_type: "explicit", dimension: "recall", evidence: [["notes", "Koldioxid (CO2): förbränning av kol, olja, naturgas; avskogning."]] },
  { key: "orsaker", title: "Fossila bränslen och avskogning", importance: 4, difficulty: 2, prerequisites: ["vaxthusgaser"], evidence_type: "explicit", dimension: "reasoning", evidence: [["planning", "Förklara hur förbränning av **fossila bränslen**, avskogning och jordbruk påverkar klimatet."]] },
  { key: "konsekvenser", title: "Konsekvenser", importance: 4, difficulty: 3, prerequisites: ["vaxthuseffekten"], evidence_type: "explicit", dimension: "analysis", evidence: [["planning", "Beskriva **konsekvenser** av den globala uppvärmningen"]] },
  { key: "albedo", title: "Albedo", importance: 4, difficulty: 4, prerequisites: ["vaxthuseffekten"], evidence_type: "explicit", dimension: "reasoning", evidence: [["teacher_said", "Albedo kommer på provet."]] },
  { key: "atgarder", title: "Åtgärder och Parisavtalet", importance: 4, difficulty: 3, prerequisites: ["orsaker"], evidence_type: "explicit", dimension: "reasoning", evidence: [["teacher_said", "Den långa frågan i slutet handlar om åtgärder – tänk individ, samhälle och globalt."]] },
  // Deliberately hallucinated quote: the app must downgrade this topic to "inferred".
  { key: "diagram", title: "Tolka diagram", importance: 3, difficulty: 2, prerequisites: [], evidence_type: "explicit", dimension: "application", evidence: [["planning", "Diagramfrågan ger dubbla poäng på provet"]] },
];

export const MATH_TOPICS: TopicFixture[] = [
  { key: "ekvation_begrepp", title: "Vad är en ekvation", importance: 3, difficulty: 1, prerequisites: [], evidence_type: "explicit", dimension: "understanding", evidence: [["planning", "Förklara vad en **ekvation** är och vad det betyder att **lösa** en ekvation."]] },
  { key: "prioritering", title: "Prioriteringsregler", importance: 3, difficulty: 2, prerequisites: [], evidence_type: "inferred", dimension: "application", evidence: [["planning", "Räknesätten och **prioriteringsreglerna**"]] },
  { key: "ett_steg", title: "Ekvationer i ett steg", importance: 4, difficulty: 1, prerequisites: ["ekvation_begrepp"], evidence_type: "explicit", dimension: "application", evidence: [["planning", "Lösa ekvationer i **ett steg**, t.ex. x + 7 = 12 och 4x = 28."]] },
  { key: "tva_steg", title: "Ekvationer i två steg", importance: 5, difficulty: 2, prerequisites: ["ett_steg"], evidence_type: "explicit", dimension: "application", evidence: [["planning", "Lösa ekvationer i **två steg**, t.ex. 3x − 5 = 16."]] },
  { key: "x_bada_sidor", title: "x på båda sidor", importance: 4, difficulty: 3, prerequisites: ["tva_steg"], evidence_type: "explicit", dimension: "application", evidence: [["teacher_said", "Det kommer en uppgift med parenteser, och en med x på båda sidor."]] },
  { key: "parenteser", title: "Ekvationer med parenteser", importance: 4, difficulty: 4, prerequisites: ["tva_steg", "prioritering"], evidence_type: "explicit", dimension: "application", evidence: [["criteria", "Att bara multiplicera första termen i parentesen"]] },
  { key: "problemlosning", title: "Problemlösning med ekvationer", importance: 5, difficulty: 4, prerequisites: ["tva_steg"], evidence_type: "explicit", dimension: "problem_solving", evidence: [["teacher_said", "Sista uppgiften är en textuppgift där ni själva ska ställa upp ekvationen."]] },
  { key: "prova", title: "Pröva lösningen", importance: 3, difficulty: 1, prerequisites: ["ett_steg"], evidence_type: "explicit", dimension: "recall", evidence: [["teacher_said", "Pröva alltid ert svar!"]] },
];

let nonce = 0;
/** Unique words so generated prompts never look like re-used questions. */
const fresh = () => {
  nonce++;
  return `ref${nonce}a ref${nonce}b ref${nonce}c ref${nonce}d`;
};

function materialIds(user: string) {
  const out: Record<string, string[]> = {};
  for (const m of user.matchAll(/<material source_material_id="([^"]+)" kategori="([^"]+)"/g)) (out[m[2]] ??= []).push(m[1]);
  return out;
}

function parseTopics(text: string) {
  return [...text.matchAll(/- key: (\S+)\n {2}titel: (.+)\n {2}beskrivning: .*\n {2}viktighet: (\d)\/5/g)].map((m) => ({ key: m[1], title: m[2], importance: Number(m[3]) }));
}

const mcq = (id: string, topic_key: string, prompt: string) => ({
  type: "mcq" as const,
  id,
  topic_key,
  prompt,
  difficulty: 2,
  dimension: "understanding" as const,
  options: ["Det korrekta påståendet", "Ett påstående som bygger på en missuppfattning", "Ett annat felaktigt påstående"],
  correct_index: 0,
  explanation: "Det första påståendet stämmer med underlaget.",
  misconception_by_option: [null, `Vanlig missuppfattning om ${topic_key}`, null],
});

const explain = (id: string, topic_key: string, prompt: string, type: "explain" | "reasoning" = "explain") => ({
  type,
  id,
  topic_key,
  prompt,
  difficulty: 2,
  dimension: "reasoning" as const,
  key_points: ["Nämner orsaken", "Förklarar mekanismen", "Beskriver konsekvensen"],
  rubric: "Full poäng om alla tre leden finns med.",
});

function route(req: StructuredRequest<z.ZodType>): unknown {
  switch (req.name) {
    case "knowledge_map": {
      const subject = /Ämne: (.+)/.exec(req.user)![1].trim();
      const topics = subject === "Matematik" ? MATH_TOPICS : GEOGRAPHY_TOPICS;
      const ids = materialIds(req.user);
      return {
        summary: `Provet handlar om ${subject.toLowerCase()} enligt lärarens planering.`,
        has_grading_criteria: Boolean(ids[CATEGORY.criteria]),
        warnings: [],
        topics: topics.map((t) => ({
          key: t.key,
          title: t.title,
          description: `Du ska kunna ${t.title.toLowerCase()}.`,
          parent_key: null,
          importance: t.importance,
          difficulty: t.difficulty,
          prerequisites: t.prerequisites,
          required_skills: [`Förklara ${t.title.toLowerCase()}`],
          likely_question_types: ["förklara", "flerval"],
          evidence_type: t.evidence_type,
          inference_reason: t.evidence_type === "inferred" ? "Förkunskap som krävs för området." : null,
          source_evidence: t.evidence.map(([cat, quote]) => ({ source_material_id: ids[CATEGORY[cat as keyof typeof CATEGORY]][0], quote })),
          assessment_dimension: t.dimension,
        })),
      };
    }

    case "diagnostic_test": {
      const topics = parseTopics(req.user);
      // One question per topic first (coverage), then a second one for important topics.
      const questions: unknown[] = topics.map((t, i) => mcq(`d${i}a`, t.key, `Vilket påstående om ${t.title} stämmer? ${fresh()}`));
      topics.forEach((t, i) => t.importance >= 4 && questions.push(explain(`d${i}b`, t.key, `Förklara ${t.title} med egna ord. ${fresh()}`)));
      while (questions.length < 8) questions.push(explain(`pad${questions.length}`, topics[0].key, `Beskriv ett exempel på ${topics[0].title}. ${fresh()}`, "reasoning"));
      return { questions: questions.slice(0, 15) };
    }

    case "clarifying_questions": {
      const topics = parseTopics(req.user);
      return {
        questions: [
          { question: "Vilka kapitel i boken ingår i provet?", why: "Då vet vi vad som ska tränas.", options: ["Kapitel 1–2", "Kapitel 1–3", "Hela boken"], allow_free_text: true, topic_keys: [] },
          { question: `Har läraren sagt att ${topics.at(-1)!.title} är viktigt?`, why: "Det är osäkert i underlaget.", options: ["Ja", "Nej", "Det kommer inte på provet"], allow_free_text: false, topic_keys: [topics.at(-1)!.key] },
          { question: "Får man använda miniräknare?", why: "Påverkar vilka uppgifter vi övar på.", options: ["Ja", "Nej"], allow_free_text: false, topic_keys: [] },
        ],
      };
    }

    case "map_refinement": {
      const topics = parseTopics(req.user);
      const answers = [...req.user.matchAll(/Svar: (.+)/g)].map((m) => m[1]);
      const out = { summary: "Vi la till det du nämnde och tog bort det som inte ingår.", topic_updates: [] as unknown[], new_topics: [] as unknown[] };
      if (answers.some((a) => a.includes("kommer inte på provet"))) out.topic_updates.push({ key: topics.at(-1)!.key, importance: 1, remove: true, reason: "Du sa att det inte kommer på provet." });
      if (topics.some((t) => t.key === "albedo")) out.topic_updates.push({ key: "albedo", importance: 5, remove: false, reason: "Läraren har betonat det." });
      const kretslopp = answers.find((a) => /kretslopp/i.test(a));
      if (kretslopp)
        out.new_topics.push({ key: "kolets_kretslopp", title: "Kolets kretslopp", description: "Hur kol rör sig mellan luft, hav, växter och berggrund.", importance: 4, difficulty: 3, assessment_dimension: "understanding", quote: kretslopp });
      return out;
    }

    case "answer_grade": {
      const answer = /<elevens_svar>\n?([\s\S]*?)\n?<\/elevens_svar>/.exec(req.user)?.[1] ?? "";
      if (answer.includes("RÄTT")) return { score: 1, is_correct: true, feedback: "Du nämner orsak, mekanism och konsekvens.", error_type: "none", misconception: null, prerequisite_gap: false };
      if (answer.includes("DELVIS")) return { score: 0.5, is_correct: false, feedback: "Du beskriver orsaken men förklarar inte mekanismen.", error_type: "incomplete", misconception: null, prerequisite_gap: false };
      if (answer.includes("OZON")) return { score: 0, is_correct: false, feedback: "Du blandar ihop växthuseffekten med ozonlagret.", error_type: "misconception", misconception: "Blandar ihop växthuseffekten med ozonlagret", prerequisite_gap: false };
      return { score: 0, is_correct: false, feedback: "Svaret saknar de viktiga leden.", error_type: "concept", misconception: null, prerequisite_gap: false };
    }

    case "lesson": {
      const lesson = /Matematik/.test(req.system) ? equationsLesson : greenhouseLesson;
      return { title: lesson.title, scenes: lesson.scenes, checkpoints: lesson.checkpoints };
    }

    case "micro_lesson":
      return { title: "Mikrolektion", scenes: [greenhouseLesson.checkpoints[0].remedy_scenes[0], greenhouseLesson.scenes.at(-1)] };

    case "exercise_set": {
      const [, count, key] = /Skapa exakt (\d+) frågor, alla med topic_key "([^"]+)"/.exec(req.system)!;
      return { questions: Array.from({ length: Number(count) }, (_, i) => mcq(`e${i}`, key, `Övningsfråga ${fresh()}: vilket påstående om ${key} stämmer?`)) };
    }

    case "mock_exam": {
      const final = /slutprov/.test(req.system);
      const topics = parseTopics(req.user);
      const ids = materialIds(req.user);
      const anyId = Object.values(ids)[0]?.[0];
      return {
        instructions: "Svara så utförligt du kan. Visa hur du tänker.",
        questions: topics.map((t, i) => ({
          question:
            t.importance >= 4
              ? explain(`m${i}`, t.key, `${final ? "Slutprov" : "Övningsprov"}: resonera om ${t.title}. ${fresh()}`, "reasoning")
              : mcq(`m${i}`, t.key, `${final ? "Slutprov" : "Övningsprov"}: vad stämmer om ${t.title}? ${fresh()}`),
          points: t.importance >= 4 ? 3 : 1,
          source_material_ids: anyId ? [anyId] : [],
        })),
      };
    }

    case "mock_exam_assessment": {
      const final = /Slutprov/.test(req.user);
      const qs = [...req.user.matchAll(/<fråga id="([^"]+)" poäng="(\d+)" område="([^"]*)" topic_key="([^"]*)" typ="([^"]+)"(?: deterministic_score="([\d.]+)")?>/g)];
      const level = final ? "strong" : "weak";
      const dim = (comment: string) => ({ level, comment });
      return {
        per_question: qs.map((m) => ({
          question_id: m[1],
          score_fraction: m[6] !== undefined ? Number(m[6]) : final ? 0.85 : 0.35,
          correctness: dim("Korrekt i sak."),
          understanding: dim(""),
          method: { level: "not_applicable", comment: "" },
          reasoning: dim(final ? "Flera led." : "Saknar mellanled."),
          terminology: dim(""),
          completeness: dim(""),
          misconceptions: final ? [] : ["Blandar ihop klimat och väder"],
          feedback: final ? "Resonemanget har orsak, mekanism och konsekvens." : "Resonemanget saknar ofta mellanled.",
          source_refs: [],
        })),
        strengths: ["Du använder begreppen växthusgas och koldioxid korrekt."],
        holding_back: ["Resonemangen saknar ofta mellanled."],
        top_fixes: [
          { title: "Skriv ut mellanleden", description: "Orsak → mekanism → konsekvens.", topic_key: qs[0]?.[4] ?? null },
          { title: "Skilj på väder och klimat", description: "Klimat är genomsnitt över minst 30 år.", topic_key: null },
          { title: "Albedo", description: "Förklara återkopplingen.", topic_key: null },
        ],
        criteria_statement: "De här svaren visar just nu huvudsakligen kvaliteter som ligger omkring enkla till utvecklade resonemang.",
        remediation_targets: qs.slice(0, 3).map((m, i) => ({ topic_key: m[4], title: `Svaghet ${i + 1}: ${m[3]}`, description: "Resonemangen saknar mellanled.", priority: 5 - i })),
      };
    }

    default:
      throw new Error(`fake LLM has no fixture for "${req.name}"`);
  }
}

export async function fakeGenerateStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
  calls.push({ name: req.name, system: req.system, user: req.user });
  const parsed = req.schema.parse(route(req as StructuredRequest<z.ZodType>));
  const problems = req.validate?.(parsed) ?? [];
  if (problems.length) throw new Error(`Fixture for ${req.name} failed production validation:\n${problems.join("\n")}`);
  return parsed;
}
