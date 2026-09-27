import type { PerformancePattern } from "./mastery";

/**
 * Adaptive engine
 * ===============
 * A transparent, deterministic rule engine decides what the student does next.
 * The LLM only *analyses* answers (score, error type, misconception); the
 * decision itself is made here from numbers that are logged together with the
 * rule that fired, so every decision can be explained afterwards.
 */

export type AdaptiveAction = "SKIP" | "CONTINUE" | "REVIEW" | "MICRO_LESSON" | "EASIER_EXAMPLE" | "HARDER_QUESTION";

export type DecisionContext = "before_lesson" | "after_practice" | "after_checkpoint";

export type RecentAnswer = {
  score: number;
  is_correct: boolean;
  error_type: string | null;
  misconception: string | null;
  prerequisite_gap?: boolean;
};

export type AdaptiveInput = {
  context: DecisionContext;
  topic: {
    id: string;
    title: string;
    mastery: number | null;
    confidence: number;
    pattern: PerformancePattern;
    importance: number;
  };
  prerequisites: Array<{ id: string; title: string; mastery: number | null; confidence: number }>;
  /** Answers on this topic in the current session, oldest first. */
  recent: RecentAnswer[];
  /** How many adaptive insertions of each kind already happened for this topic in this session. */
  inserted: { micro: number; easier: number; harder: number; review: number };
};

export type AdaptiveDecision = {
  action: AdaptiveAction;
  rule: string;
  reason: string;
  /** Topic the follow-up activity is about (may be a prerequisite). */
  targetTopicId: string;
  focus: string | null;
  inputs: Record<string, unknown>;
};

export const THRESHOLDS = {
  skipMastery: 0.85,
  skipConfidence: 0.6,
  harderRecentAvg: 0.85,
  harderMastery: 0.7,
  reviewRecentAvg: 0.6,
  weakPrerequisite: 0.5,
  prerequisiteConfidence: 0.3,
  maxMicro: 1,
  maxEasier: 1,
  maxHarder: 1,
} as const;

type Rule = {
  id: string;
  description: string;
  applies: (input: AdaptiveInput, derived: Derived) => AdaptiveDecision | null;
};

type Derived = {
  recentAvg: number | null;
  wrongCount: number;
  misconception: string | null;
  weakPrerequisite: AdaptiveInput["prerequisites"][number] | null;
  prerequisiteSignal: boolean;
};

function derive(input: AdaptiveInput): Derived {
  const recent = input.recent;
  const recentAvg = recent.length ? recent.reduce((a, r) => a + r.score, 0) / recent.length : null;
  const wrong = recent.filter((r) => !r.is_correct);
  // A misconception counts when the grader named one on a wrong answer.
  const misconception = [...wrong].reverse().find((r) => r.misconception)?.misconception ?? null;
  const weakPrerequisite =
    [...input.prerequisites]
      .filter((p) => p.mastery !== null && p.mastery < THRESHOLDS.weakPrerequisite && p.confidence >= THRESHOLDS.prerequisiteConfidence)
      .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))[0] ?? null;
  const prerequisiteSignal = wrong.some((r) => r.prerequisite_gap || r.error_type === "prerequisite");
  return { recentAvg, wrongCount: wrong.length, misconception, weakPrerequisite, prerequisiteSignal };
}

const pct = (x: number | null) => (x === null ? "okänd" : `${Math.round(x * 100)} %`);

export const RULES: Rule[] = [
  {
    id: "R1_SKIP_KNOWN",
    description: "Före lektionen: hög mastery med hög säkerhet och stabilt rätt → hoppa över lektionen.",
    applies: (i) =>
      i.context === "before_lesson" &&
      i.topic.mastery !== null &&
      i.topic.mastery >= THRESHOLDS.skipMastery &&
      i.topic.confidence >= THRESHOLDS.skipConfidence &&
      i.topic.pattern === "consistent_success"
        ? {
            action: "SKIP",
            rule: "R1_SKIP_KNOWN",
            reason: `Du har redan visat att du kan ${i.topic.title} (${pct(i.topic.mastery)} med hög säkerhet). Vi hoppar över genomgången och ger dig en utmaning i stället.`,
            targetTopicId: i.topic.id,
            focus: null,
            inputs: {},
          }
        : null,
  },
  {
    id: "R2_MISCONCEPTION",
    description: "Ett fel där rättningen identifierade en specifik missuppfattning → mikrolektion om just den.",
    applies: (i, d) =>
      i.context !== "before_lesson" && d.misconception && i.inserted.micro < THRESHOLDS.maxMicro
        ? {
            action: "MICRO_LESSON",
            rule: "R2_MISCONCEPTION",
            reason: `Ditt svar tyder på en missuppfattning: "${d.misconception}". En kort mikrolektion reder ut det.`,
            targetTopicId: i.topic.id,
            focus: d.misconception,
            inputs: {},
          }
        : null,
  },
  {
    id: "R3_PREREQUISITE",
    description: "Fel som beror på förkunskaper, eller svag förkunskap + låg träffsäkerhet → enklare exempel.",
    applies: (i, d) => {
      if (i.context === "before_lesson" || i.inserted.easier >= THRESHOLDS.maxEasier) return null;
      const struggling = d.recentAvg !== null && d.recentAvg < 0.5;
      if (!(d.prerequisiteSignal || (d.weakPrerequisite && struggling))) return null;
      const target = d.weakPrerequisite ?? null;
      return {
        action: "EASIER_EXAMPLE",
        rule: "R3_PREREQUISITE",
        reason: target
          ? `Det verkar som att det som saknas är ${target.title} (${pct(target.mastery)}), som det här bygger på. Vi tar ett enklare exempel först.`
          : `Felen verkar bero på ett steg som kommer före det här. Vi tar ett enklare, löst exempel först.`,
        targetTopicId: target?.id ?? i.topic.id,
        focus: target ? `Förkunskap: ${target.title}` : "Förkunskaper som krävs för området",
        inputs: {},
      };
    },
  },
  {
    id: "R4_HARDER",
    description: "Minst två svar med hög poäng och god mastery → svårare fråga.",
    applies: (i, d) =>
      i.context === "after_practice" &&
      i.recent.length >= 2 &&
      d.recentAvg !== null &&
      d.recentAvg >= THRESHOLDS.harderRecentAvg &&
      (i.topic.mastery ?? 0) >= THRESHOLDS.harderMastery &&
      i.inserted.harder < THRESHOLDS.maxHarder
        ? {
            action: "HARDER_QUESTION",
            rule: "R4_HARDER",
            reason: `Du hade ${pct(d.recentAvg)} rätt på övningarna. Dags för en svårare uppgift.`,
            targetTopicId: i.topic.id,
            focus: null,
            inputs: {},
          }
        : null,
  },
  {
    id: "R5_REVIEW",
    description: "Låg träffsäkerhet eller blandat/återkommande fel → repetition schemaläggs.",
    applies: (i, d) =>
      i.context === "after_practice" &&
      i.inserted.review < 1 &&
      ((d.recentAvg !== null && d.recentAvg < THRESHOLDS.reviewRecentAvg) ||
        i.topic.pattern === "consistent_failure" ||
        i.topic.pattern === "mixed")
        ? {
            action: "REVIEW",
            rule: "R5_REVIEW",
            reason: `${i.topic.title} sitter inte riktigt än (${pct(d.recentAvg)} rätt nu). Vi lägger in en repetition i ett kommande pass.`,
            targetTopicId: i.topic.id,
            focus: null,
            inputs: {},
          }
        : null,
  },
];

export function decideNext(input: AdaptiveInput): AdaptiveDecision {
  const d = derive(input);
  const inputs = {
    context: input.context,
    mastery: input.topic.mastery,
    confidence: input.topic.confidence,
    pattern: input.topic.pattern,
    recent_avg: d.recentAvg,
    recent_count: input.recent.length,
    wrong_count: d.wrongCount,
    misconception: d.misconception,
    weak_prerequisite: d.weakPrerequisite ? { id: d.weakPrerequisite.id, mastery: d.weakPrerequisite.mastery } : null,
    prerequisite_signal: d.prerequisiteSignal,
    inserted: input.inserted,
  };
  for (const rule of RULES) {
    const decision = rule.applies(input, d);
    if (decision) return { ...decision, inputs };
  }
  return {
    action: "CONTINUE",
    rule: "R6_CONTINUE",
    reason:
      input.context === "before_lesson"
        ? "Vi kör genomgången som planerat."
        : `Du ligger rätt till med ${input.topic.title}. Vi fortsätter enligt planen.`,
    targetTopicId: input.topic.id,
    focus: null,
    inputs,
  };
}
