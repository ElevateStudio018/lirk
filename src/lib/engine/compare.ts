/**
 * Mock 1 vs Final Mock comparison. Deterministic – built only from the two
 * stored assessments and the knowledge map.
 */

export type TopicScore = { title: string; earned: number; max: number };

export type CompareInput = {
  topics: Array<{ id: string; title: string; importance: number; mastery: number | null; confidence: number }>;
  mock1: { total: number; max: number; topicScores: Record<string, TopicScore>; dimensionLevels: Record<string, number[]> };
  final: {
    total: number;
    max: number;
    topicScores: Record<string, TopicScore>;
    dimensionLevels: Record<string, number[]>;
    misconceptions: string[];
    topFixes: string[];
  };
};

export type TopicDelta = { topic_id: string; title: string; importance: number; before: number | null; after: number | null; delta: number | null };

export type Comparison = {
  totalBefore: number;
  totalAfter: number;
  topics: TopicDelta[];
  improved: TopicDelta[];
  uncertain: TopicDelta[];
  dimensionChanges: Array<{ dimension: string; before: number | null; after: number | null }>;
  lastMinute: string[];
};

const pct = (s?: TopicScore) => (s && s.max > 0 ? s.earned / s.max : null);
const avg = (xs?: number[]) => (xs && xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const LEVEL_VALUE: Record<string, number | null> = { strong: 1, ok: 0.66, weak: 0.33, missing: 0, not_applicable: null };

export function compareMocks(input: CompareInput): Comparison {
  const topics: TopicDelta[] = input.topics.map((t) => {
    const before = pct(input.mock1.topicScores[t.id]);
    const after = pct(input.final.topicScores[t.id]);
    return {
      topic_id: t.id,
      title: t.title,
      importance: t.importance,
      before: before === null ? null : round(before),
      after: after === null ? null : round(after),
      delta: before !== null && after !== null ? round(after - before) : null,
    };
  });

  const improved = topics.filter((t) => t.delta !== null && t.delta >= 0.1).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const masteryById = new Map(input.topics.map((t) => [t.id, t]));
  const uncertain = topics
    .filter((t) => {
      const m = masteryById.get(t.topic_id)!;
      return (t.after !== null && t.after < 0.6) || m.mastery === null || m.confidence < 0.3 || (m.mastery ?? 0) < 0.6;
    })
    .sort((a, b) => b.importance - a.importance || (a.after ?? 0) - (b.after ?? 0));

  const dims = new Set([...Object.keys(input.mock1.dimensionLevels), ...Object.keys(input.final.dimensionLevels)]);
  const dimensionChanges = [...dims].map((d) => ({
    dimension: d,
    before: nullableRound(avg(input.mock1.dimensionLevels[d])),
    after: nullableRound(avg(input.final.dimensionLevels[d])),
  }));

  const lastMinute: string[] = [];
  for (const t of uncertain.filter((u) => u.importance >= 3).slice(0, 3)) {
    lastMinute.push(`Gå igenom ${t.title} en gång till – det är viktigt på provet och sitter inte säkert än.`);
  }
  for (const m of input.final.misconceptions.slice(0, 2)) lastMinute.push(`Se upp för: ${m}`);
  for (const f of input.final.topFixes.slice(0, 2)) if (lastMinute.length < 6) lastMinute.push(f);

  return {
    totalBefore: input.mock1.max ? round(input.mock1.total / input.mock1.max) : 0,
    totalAfter: input.final.max ? round(input.final.total / input.final.max) : 0,
    topics,
    improved,
    uncertain,
    dimensionChanges,
    lastMinute,
  };
}

function round(x: number) {
  return Math.round(x * 100) / 100;
}
function nullableRound(x: number | null) {
  return x === null ? null : round(x);
}
