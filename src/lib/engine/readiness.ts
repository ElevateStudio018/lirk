/**
 * Provberedskap (exam readiness)
 * ==============================
 * Never a magic number: it is an importance-weighted average of per-topic
 * scores, and every component is returned so the UI can show exactly how it
 * was calculated.
 *
 *   topic_score = mastery × (0.6 + 0.4·confidence) × retention
 *   retention   = 0.7 + 0.3 · 0.5^(days_since_practice / half_life)
 *   readiness   = Σ importance·topic_score / Σ importance
 *   coverage    = Σ importance of topics with enough evidence / Σ importance
 *
 * Topics without any evidence contribute 0, which is why coverage is shown
 * next to readiness: low readiness can mean "not learned" or "not measured".
 */

export type ReadinessTopic = {
  id: string;
  title: string;
  importance: number;
  mastery: number | null;
  confidence: number;
  lastPracticedAt: string | null;
  successfulReviews?: number;
};

export type ReadinessBreakdown = {
  topic_id: string;
  title: string;
  importance: number;
  mastery: number;
  confidence: number;
  retention: number;
  days_since_practice: number | null;
  topic_score: number;
  weight_share: number;
  contribution: number;
  measured: boolean;
};

export type Readiness = {
  score: number; // 0–1
  coverage: number; // 0–1
  averageConfidence: number;
  topics: ReadinessBreakdown[];
};

export const MEASURED_CONFIDENCE = 0.3;

export function retentionFactor(daysSince: number | null, successfulReviews = 0): number {
  if (daysSince === null) return 1;
  const halfLife = 3 + 4 * Math.min(4, successfulReviews);
  return 0.7 + 0.3 * Math.pow(0.5, Math.max(0, daysSince) / halfLife);
}

export function computeReadiness(topics: ReadinessTopic[], now: Date = new Date()): Readiness {
  const totalImportance = topics.reduce((a, t) => a + t.importance, 0) || 1;
  const breakdown = topics.map((t) => {
    const days = t.lastPracticedAt ? Math.max(0, (now.getTime() - new Date(t.lastPracticedAt).getTime()) / 86_400_000) : null;
    const mastery = t.mastery ?? 0;
    const retention = retentionFactor(days, t.successfulReviews ?? 0);
    const topic_score = mastery * (0.6 + 0.4 * t.confidence) * retention;
    const weight_share = t.importance / totalImportance;
    return {
      topic_id: t.id,
      title: t.title,
      importance: t.importance,
      mastery: r(mastery),
      confidence: r(t.confidence),
      retention: r(retention),
      days_since_practice: days === null ? null : Math.round(days * 10) / 10,
      topic_score: r(topic_score),
      weight_share: r(weight_share),
      contribution: r(topic_score * weight_share),
      measured: t.mastery !== null && t.confidence >= MEASURED_CONFIDENCE,
    };
  });
  const score = breakdown.reduce((a, b) => a + b.contribution, 0);
  const coverage = breakdown.filter((b) => b.measured).reduce((a, b) => a + b.weight_share, 0);
  const averageConfidence = topics.length ? topics.reduce((a, t) => a + t.confidence, 0) / topics.length : 0;
  return {
    score: r(score),
    coverage: r(coverage),
    averageConfidence: r(averageConfidence),
    topics: breakdown.sort((a, b) => b.weight_share - a.weight_share),
  };
}

export function readinessLabel(score: number, coverage: number): string {
  if (coverage < 0.4) return "För tidigt att säga";
  if (score >= 0.75) return "Mycket bra läge";
  if (score >= 0.55) return "På god väg";
  if (score >= 0.35) return "En bit kvar";
  return "Mycket kvar att träna";
}

function r(x: number) {
  return Math.round(x * 1000) / 1000;
}
