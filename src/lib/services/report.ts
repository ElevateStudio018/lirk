import "server-only";

import { DIMENSIONS } from "@/lib/ai/tasks/assessment";
import { compareMocks, LEVEL_VALUE } from "@/lib/engine/compare";
import type { DB } from "@/lib/supabase/server";
import type { OverallAssessment, PerQuestionResult, TopicScores } from "./assessment";
import { dbError } from "./errors";
import { getTopics } from "./projects";

export async function getAssessmentsByKind(db: DB, projectId: string) {
  const { data, error } = await db
    .from("mock_exams")
    .select("id, kind, title, exam_attempts(id, status, submitted_at, assessment_results(*))")
    .eq("project_id", projectId);
  if (error) dbError(error, "getAssessmentsByKind");
  const out: Partial<Record<"mock1" | "final", { examId: string; attemptId: string | null; status: string | null; result: AssessmentRow | null }>> = {};
  for (const e of data ?? []) {
    const attempt = (e.exam_attempts as Array<{ id: string; status: string; assessment_results: AssessmentRow | AssessmentRow[] | null }>)[0];
    const res = attempt?.assessment_results;
    out[e.kind as "mock1" | "final"] = {
      examId: e.id,
      attemptId: attempt?.id ?? null,
      status: attempt?.status ?? null,
      result: Array.isArray(res) ? (res[0] ?? null) : (res ?? null),
    };
  }
  return out;
}

type AssessmentRow = {
  id: string;
  total_score: number;
  max_score: number;
  topic_scores: unknown;
  per_question: unknown;
  overall: unknown;
};

function dimensionLevels(perQuestion: PerQuestionResult[]) {
  const out: Record<string, number[]> = {};
  for (const d of DIMENSIONS) {
    out[d] = perQuestion.map((p) => LEVEL_VALUE[p[d]?.level ?? "not_applicable"]).filter((v): v is number => v !== null);
  }
  return out;
}

export async function getFinalReport(db: DB, projectId: string) {
  const [topics, byKind] = await Promise.all([getTopics(db, projectId), getAssessmentsByKind(db, projectId)]);
  const m1 = byKind.mock1?.result;
  const fin = byKind.final?.result;
  if (!m1 || !fin) return null;
  const m1pq = m1.per_question as PerQuestionResult[];
  const finpq = fin.per_question as PerQuestionResult[];
  const finOverall = fin.overall as OverallAssessment;
  return compareMocks({
    topics: topics.map((t) => ({ id: t.id, title: t.title, importance: t.importance, mastery: t.mastery, confidence: t.confidence })),
    mock1: { total: m1.total_score, max: m1.max_score, topicScores: m1.topic_scores as TopicScores, dimensionLevels: dimensionLevels(m1pq) },
    final: {
      total: fin.total_score,
      max: fin.max_score,
      topicScores: fin.topic_scores as TopicScores,
      dimensionLevels: dimensionLevels(finpq),
      misconceptions: [...new Set(finpq.flatMap((p) => p.misconceptions))],
      topFixes: finOverall.top_fixes.map((f) => `${f.title}: ${f.description}`),
    },
  });
}
