/**
 * Mastery model
 * =============
 * Mastery is never taken from a single answer. Each topic's evidence history
 * (question_attempts) is folded into a Beta distribution with a Jeffreys
 * prior Beta(½, ½) – uninformative, but lets a few consistent answers move
 * the estimate while `confidence` still reports how thin the evidence is:
 *
 *   alpha = ½ + Σ w·score        beta = ½ + Σ w·(1 − score)
 *   mastery    = alpha / (alpha + beta)
 *   confidence = n / (n + K)      where n = Σ w (effective evidence)
 *
 * Weights reflect how informative an answer is: multiple choice can be guessed,
 * mock exams are the most exam-like, and old evidence decays so the model
 * follows the student's recent development.
 */

export type EvidenceSource = "diagnostic" | "exercise" | "checkpoint" | "mock" | "remediation";

export type Evidence = {
  score: number; // 0–1
  weight: number; // stored per attempt (question type informativeness)
  source: EvidenceSource;
  created_at: string | Date;
};

export type PerformancePattern = "consistent_success" | "consistent_failure" | "mixed" | "insufficient_evidence";

export type MasteryEstimate = {
  mastery: number | null;
  confidence: number;
  pattern: PerformancePattern;
  evidenceCount: number;
  effectiveEvidence: number;
};

export const SOURCE_WEIGHT: Record<EvidenceSource, number> = {
  diagnostic: 1,
  exercise: 1,
  checkpoint: 0.5,
  mock: 1.5,
  remediation: 1,
};

/** How informative a single answer of this type is (guessing risk etc). */
export const QUESTION_TYPE_WEIGHT: Record<string, number> = {
  mcq: 0.6,
  match_concepts: 0.8,
  order_steps: 0.8,
  find_the_error: 0.9,
  short_answer: 0.9,
  numeric: 1,
  step_by_step: 1.2,
  explain: 1.1,
  reasoning: 1.2,
};

export const CONFIDENCE_K = 2.5;
const PRIOR = 0.5;
const HALF_LIFE_DAYS = 21;
const MIN_DECAY = 0.35;
const SUCCESS = 0.7;

export function attemptWeight(questionType: string, difficulty = 2): number {
  const base = QUESTION_TYPE_WEIGHT[questionType] ?? 1;
  // Harder questions tell us a little more.
  return Math.round(base * (0.85 + 0.075 * (difficulty - 1)) * 100) / 100;
}

export function estimateMastery(evidence: Evidence[], now: Date = new Date()): MasteryEstimate {
  if (evidence.length === 0) {
    return { mastery: null, confidence: 0, pattern: "insufficient_evidence", evidenceCount: 0, effectiveEvidence: 0 };
  }

  let alpha = PRIOR;
  let beta = PRIOR;
  let n = 0;
  for (const e of evidence) {
    const ageDays = Math.max(0, (now.getTime() - new Date(e.created_at).getTime()) / 86_400_000);
    const decay = Math.max(MIN_DECAY, Math.pow(0.5, ageDays / HALF_LIFE_DAYS));
    const w = e.weight * SOURCE_WEIGHT[e.source] * decay;
    const s = Math.min(1, Math.max(0, e.score));
    alpha += w * s;
    beta += w * (1 - s);
    n += w;
  }

  const mastery = alpha / (alpha + beta);
  const confidence = n / (n + CONFIDENCE_K);

  return {
    mastery: round(mastery),
    confidence: round(confidence),
    pattern: classifyPattern(evidence, n),
    evidenceCount: evidence.length,
    effectiveEvidence: round(n),
  };
}

export function classifyPattern(evidence: Evidence[], effective?: number): PerformancePattern {
  const n = effective ?? evidence.reduce((acc, e) => acc + e.weight, 0);
  if (evidence.length < 2 || n < 1.5) return "insufficient_evidence";
  const sorted = [...evidence].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const recent = sorted.slice(-6);
  const successRate = recent.filter((e) => e.score >= SUCCESS).length / recent.length;
  if (successRate >= 0.8) return "consistent_success";
  if (successRate <= 0.2) return "consistent_failure";
  return "mixed";
}

export type MasteryStatus = "good" | "warn" | "bad" | "unknown";

/** Traffic-light status used everywhere in the UI. Grey means "too little data". */
export function masteryStatus(mastery: number | null, confidence: number): MasteryStatus {
  if (mastery === null || confidence < 0.3) return "unknown";
  if (mastery >= 0.75) return "good";
  if (mastery >= 0.5) return "warn";
  return "bad";
}

export const STATUS_LABEL: Record<MasteryStatus, string> = {
  good: "Bra koll",
  warn: "På väg",
  bad: "Behöver träning",
  unknown: "För lite data",
};

export const PATTERN_LABEL: Record<PerformancePattern, string> = {
  consistent_success: "Stabilt rätt",
  consistent_failure: "Återkommande fel",
  mixed: "Blandat",
  insufficient_evidence: "För lite underlag",
};

function round(x: number) {
  return Math.round(x * 1000) / 1000;
}
