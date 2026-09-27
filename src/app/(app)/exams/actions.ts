"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { todayISO } from "@/lib/engine/dates";
import { requireUser } from "@/lib/supabase/server";

const NewProject = z.object({
  subject: z.string().trim().min(1, "Välj ett ämne.").max(80),
  title: z.string().trim().min(1, "Skriv vad provet heter.").max(160),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Välj ett datum."),
  minutes_per_session: z.number().int().min(5).max(180),
  available_days: z.array(z.number().int().min(1).max(7)).min(1, "Välj minst en dag."),
  target_grade: z.enum(["E", "D", "C", "B", "A"]).nullable(),
});

export type NewProjectInput = z.infer<typeof NewProject>;

export async function createProject(input: NewProjectInput): Promise<{ id?: string; error?: string }> {
  const parsed = NewProject.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.exam_date < todayISO()) return { error: "Provdatumet har redan passerat." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("study_projects").insert(parsed.data).select("id").single();
  if (error) return { error: "Kunde inte skapa provet. Försök igen." };
  revalidatePath("/dashboard");
  return { id: data.id };
}

const TextMaterial = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(["paste", "teacher_note"]),
  text: z.string().trim().min(3, "Skriv lite mer text.").max(100_000),
  category: z.enum(["planning", "criteria", "notes", "teacher_said", "other"]),
  title: z.string().trim().max(120).optional(),
});

/** Adds pasted text or "the teacher said…" as a material. Returns its id so it can be processed. */
export async function addTextMaterial(input: z.infer<typeof TextMaterial>): Promise<{ id?: string; error?: string }> {
  const parsed = TextMaterial.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("source_materials")
    .insert({
      project_id: parsed.data.projectId,
      type: parsed.data.kind,
      category: parsed.data.kind === "teacher_note" ? "teacher_said" : parsed.data.category,
      filename: parsed.data.title || (parsed.data.kind === "teacher_note" ? "Det här har läraren sagt" : "Inklistrad text"),
      mime_type: "text/plain",
      extracted_text: parsed.data.text,
      processing_status: "uploaded",
    })
    .select("id")
    .single();
  if (error) return { error: "Kunde inte spara texten." };
  return { id: data.id };
}

export async function deleteMaterial(materialId: string) {
  const { supabase } = await requireUser();
  const { data: m } = await supabase.from("source_materials").select("storage_path, project_id").eq("id", materialId).maybeSingle();
  if (!m) return { error: "Materialet finns inte." };
  if (m.storage_path) await supabase.storage.from("materials").remove([m.storage_path]);
  const { error } = await supabase.from("source_materials").delete().eq("id", materialId);
  if (error) return { error: "Kunde inte ta bort materialet." };
  revalidatePath(`/exams/${m.project_id}/materials`);
  return { ok: true };
}

export async function updateMaterialCategory(materialId: string, category: string) {
  const parsed = z.enum(["planning", "criteria", "notes", "teacher_said", "other"]).safeParse(category);
  if (!parsed.success) return { error: "Ogiltig kategori." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("source_materials").update({ category: parsed.data }).eq("id", materialId);
  if (error) return { error: "Kunde inte spara." };
  return { ok: true };
}

export async function deleteProject(projectId: string) {
  const { supabase, user } = await requireUser();
  const { data: files } = await supabase.storage.from("materials").list(`${user.id}/${projectId}`);
  if (files?.length) await supabase.storage.from("materials").remove(files.map((f) => `${user.id}/${projectId}/${f.name}`));
  await supabase.from("study_projects").delete().eq("id", projectId);
  revalidatePath("/dashboard");
  redirect("/exams");
}
