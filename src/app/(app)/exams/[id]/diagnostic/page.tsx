import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getDiagnosticForStudent, summarize } from "@/lib/services/diagnostic";
import { getProject, getTopics } from "@/lib/services/projects";
import { requireUser } from "@/lib/supabase/server";
import { DiagnosticRunner } from "./diagnostic-runner";

export default async function DiagnosticPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const project = await getProject(supabase, id);

  if (["collecting", "analyzing"].includes(project.status)) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Först behöver vi veta vad provet handlar om"
        description="Testet bygger på kunskapskartan. Lägg in underlag och analysera det först."
        action={
          <Link href={`/exams/${id}/materials`} className={buttonVariants()}>
            Till underlaget
          </Link>
        }
      />
    );
  }

  const [questions, topics] = await Promise.all([getDiagnosticForStudent(supabase, id), getTopics(supabase, id)]);
  const done = project.status !== "map_ready";
  const summary = done
    ? summarize(
        topics,
        topics.map((t) => ({ topic_id: t.id, mastery: t.mastery, confidence: t.confidence })),
      )
    : null;
  const { data: plan } = await supabase.from("study_plans").select("id").eq("project_id", id).eq("is_active", true).maybeSingle();

  return (
    <DiagnosticRunner
      projectId={id}
      questions={questions.map((q) => ({ id: q.id, answered: q.answered, question: q.question }))}
      topicCount={topics.length}
      initialSummary={summary}
      hasPlan={Boolean(plan)}
    />
  );
}
