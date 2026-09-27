import { Loader2, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { masteryStatus } from "@/lib/engine/mastery";
import { requireUser } from "@/lib/supabase/server";
import { TopicMap } from "./topic-map";

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [{ data: project }, { data: topics }, { data: materials }] = await Promise.all([
    supabase.from("study_projects").select("id, status, map_summary, map_warnings, has_grading_criteria").eq("id", id).single(),
    supabase.from("knowledge_topics").select("*").eq("project_id", id).order("sort_order"),
    supabase.from("source_materials").select("id, filename, category, type").eq("project_id", id),
  ]);

  if (!topics?.length) {
    if (project?.status === "analyzing") {
      return <EmptyState icon={Loader2} title="Analysen pågår" description="Kartan dyker upp här när den är klar. Det brukar ta under en minut." />;
    }
    return (
      <EmptyState
        icon={MapIcon}
        title="Ingen kunskapskarta ännu"
        description="Lägg in underlag och låt oss analysera det, så ser du här exakt vad du behöver kunna."
        action={
          <Link href={`/exams/${id}/materials`} className={buttonVariants({ variant: "primary" })}>
            Till underlaget
          </Link>
        }
      />
    );
  }

  return (
    <TopicMap
      projectId={id}
      status={project?.status ?? "map_ready"}
      summary={project?.map_summary ?? null}
      warnings={project?.map_warnings ?? []}
      hasCriteria={project?.has_grading_criteria ?? false}
      materials={Object.fromEntries((materials ?? []).map((m) => [m.id, { filename: m.filename ?? "Material", category: m.category }]))}
      topics={topics.map((t) => ({
        id: t.id,
        parent_id: t.parent_id,
        title: t.title,
        description: t.description,
        importance: t.importance,
        difficulty: t.difficulty,
        evidence_type: t.evidence_type as "explicit" | "inferred",
        inference_reason: t.inference_reason,
        evidence: (Array.isArray(t.evidence) ? t.evidence : []) as Array<{ source_material_id: string; quote: string; verified: boolean }>,
        required_skills: t.required_skills,
        likely_question_types: t.likely_question_types,
        prerequisite_ids: t.prerequisite_ids,
        status: masteryStatus(t.mastery, t.confidence),
      }))}
    />
  );
}
