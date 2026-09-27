import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getActivePlan } from "@/lib/services/plan";
import { getProject } from "@/lib/services/projects";
import { requireUser } from "@/lib/supabase/server";
import { BuildButton, PlanView } from "./plan-view";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [project, active, { data: decisions }] = await Promise.all([
    getProject(supabase, id),
    getActivePlan(supabase, id),
    supabase
      .from("adaptive_decisions")
      .select("id, action, rule, reason, created_at, knowledge_topics(title)")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!active) {
    const canBuild = project.status === "diagnosed";
    return (
      <EmptyState
        icon={CalendarDays}
        title={canBuild ? "Dags att bygga din plan" : "Planen kommer efter testet"}
        description={
          canBuild
            ? "Vi fördelar det du behöver träna på fram till provdagen."
            : "Planen anpassas efter vad du redan kan. Gör det korta testet först."
        }
        action={
          canBuild ? (
            <BuildButton projectId={id} />
          ) : (
            <Link href={`/exams/${id}/diagnostic`} className={buttonVariants()}>
              Till testet
            </Link>
          )
        }
      />
    );
  }

  const rationale = active.plan.rationale as {
    priorities?: Array<{ topic_id: string; title: string; priority: number; importance: number; gap: number; certainty: number; prerequisite_weight: number; decision: string }>;
    notes?: string[];
  };

  return (
    <PlanView
      projectId={id}
      sessions={active.sessions.map((s) => ({
        id: s.id,
        title: s.title,
        goal: s.goal,
        kind: s.kind,
        status: s.status,
        scheduled_date: s.scheduled_date,
        estimated_minutes: s.estimated_minutes,
      }))}
      notes={rationale.notes ?? []}
      priorities={rationale.priorities ?? []}
      decisions={(decisions ?? []).map((d) => ({
        id: d.id,
        action: d.action,
        reason: d.reason,
        created_at: d.created_at,
        topic: (d.knowledge_topics as { title: string } | null)?.title ?? null,
      }))}
      version={active.plan.version}
    />
  );
}
