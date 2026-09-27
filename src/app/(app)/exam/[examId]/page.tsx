import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMockExamView } from "@/lib/services/mock-exams";
import { requireUser } from "@/lib/supabase/server";
import { ExamTaker } from "./exam-taker";

export const metadata: Metadata = { title: "Övningsprov" };

export default async function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const { supabase } = await requireUser();
  const view = await getMockExamView(supabase, examId);
  if (view.attempt && view.attempt.status !== "in_progress") redirect(`/results/${view.attempt.id}`);
  return (
    <ExamTaker
      exam={{
        id: view.exam.id,
        projectId: view.exam.project_id,
        title: view.exam.title,
        kind: view.exam.kind,
        instructions: view.exam.instructions,
        timeLimit: view.exam.time_limit_minutes,
        totalPoints: view.exam.total_points,
      }}
      questions={view.questions}
      attempt={view.attempt ? { id: view.attempt.id, startedAt: view.attempt.started_at, answers: view.attempt.answers as Record<string, never> } : null}
    />
  );
}
