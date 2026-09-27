import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { OverallAssessment, PerQuestionResult } from "@/lib/services/assessment";
import { requireUser } from "@/lib/supabase/server";
import { AssessmentPending } from "./assessment-pending";
import { ResultView } from "./result-view";

export const metadata: Metadata = { title: "Resultat" };

export default async function ResultsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { supabase } = await requireUser();
  const { data: attempt } = await supabase.from("exam_attempts").select("*, mock_exams(id, kind, title, project_id)").eq("id", attemptId).maybeSingle();
  if (!attempt) notFound();
  const exam = attempt.mock_exams as { id: string; kind: "mock1" | "final"; title: string; project_id: string };

  if (attempt.status === "in_progress") {
    return <AssessmentPending attemptId={attemptId} status="in_progress" examId={exam.id} error={null} />;
  }
  const { data: result } = await supabase.from("assessment_results").select("*").eq("attempt_id", attemptId).maybeSingle();
  if (!result) {
    return <AssessmentPending attemptId={attemptId} status={attempt.status} examId={exam.id} error={attempt.error_message} />;
  }

  const [{ data: targets }, { data: materials }, { data: remediation }] = await Promise.all([
    supabase.from("remediation_targets").select("*").eq("assessment_id", result.id).order("priority", { ascending: false }),
    supabase.from("source_materials").select("id, filename").eq("project_id", exam.project_id),
    supabase.from("study_sessions").select("id, status").eq("project_id", exam.project_id).eq("kind", "remediation_final").neq("status", "completed").maybeSingle(),
  ]);

  return (
    <ResultView
      exam={exam}
      totalScore={result.total_score}
      maxScore={result.max_score}
      criteriaAvailable={result.criteria_available}
      overall={result.overall as OverallAssessment}
      perQuestion={result.per_question as PerQuestionResult[]}
      targets={(targets ?? []).map((t) => ({ id: t.id, title: t.title, description: t.description, status: t.status }))}
      materials={Object.fromEntries((materials ?? []).map((m) => [m.id, m.filename ?? "Material"]))}
      remediationSessionId={remediation?.id ?? null}
    />
  );
}
