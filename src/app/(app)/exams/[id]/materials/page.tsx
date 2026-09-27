import { requireUser } from "@/lib/supabase/server";
import { MaterialsManager } from "./materials-manager";

export default async function MaterialsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ upload_errors?: string }> }) {
  const { id } = await params;
  const { upload_errors } = await searchParams;
  const { supabase } = await requireUser();
  const [{ data: project }, { data: materials }] = await Promise.all([
    supabase.from("study_projects").select("id, status").eq("id", id).single(),
    supabase
      .from("source_materials")
      .select("id, type, category, filename, processing_status, error_message, normalized_text, page_count, extraction_method, created_at")
      .eq("project_id", id)
      .order("created_at"),
  ]);
  return (
    <MaterialsManager
      projectId={id}
      projectStatus={project?.status ?? "collecting"}
      uploadErrors={upload_errors ? upload_errors.split("\n") : []}
      materials={(materials ?? []).map((m) => ({
        ...m,
        preview: m.normalized_text ? m.normalized_text.slice(0, 4000) : null,
        chars: m.normalized_text?.length ?? 0,
        normalized_text: undefined,
      }))}
    />
  );
}
