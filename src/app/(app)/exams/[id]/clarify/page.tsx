import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getClarifyingQuestions } from "@/lib/services/clarify";
import { getProject } from "@/lib/services/projects";
import { requireUser } from "@/lib/supabase/server";
import { ClarifyRunner } from "./clarify-runner";

export default async function ClarifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const project = await getProject(supabase, id);

  if (project.status !== "map_ready") {
    const before = ["collecting", "analyzing"].includes(project.status);
    return (
      <EmptyState
        icon={MessageCircleQuestion}
        title={before ? "Frågorna kommer efter analysen" : "Du har redan gått vidare"}
        description={before ? "När AI:n har läst ditt underlag ställer den några frågor om det som är oklart." : "Följdfrågorna hör till steget innan det diagnostiska testet."}
        action={
          <Link href={`/exams/${id}${before ? "/materials" : ""}`} className={buttonVariants()}>
            {before ? "Till underlaget" : "Till översikten"}
          </Link>
        }
      />
    );
  }

  const questions = await getClarifyingQuestions(supabase, id);
  return (
    <ClarifyRunner
      projectId={id}
      done={Boolean(project.clarified_at)}
      questions={questions.map((q) => ({ id: q.id, question: q.question, why: q.why, options: q.options, allowFreeText: q.allow_free_text, answered: Boolean(q.answered_at), answer: q.answer }))}
    />
  );
}
