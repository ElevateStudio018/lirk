import "server-only";

import type { DB } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { PromptTopic } from "@/lib/ai/tasks/topic-context";
import type { PromptMaterial } from "@/lib/ai/material-context";
import { dbError, notFound } from "./errors";

export type Project = Tables<"study_projects">;
export type Topic = Tables<"knowledge_topics">;
export type Material = Tables<"source_materials">;

export async function getProject(db: DB, id: string): Promise<Project> {
  const { data, error } = await db.from("study_projects").select("*").eq("id", id).maybeSingle();
  if (error) dbError(error, "getProject");
  if (!data) throw notFound("Provet");
  return data;
}

export async function setProjectStatus(db: DB, id: string, status: Project["status"]) {
  const { error } = await db.from("study_projects").update({ status }).eq("id", id);
  if (error) dbError(error, "setProjectStatus");
}

export async function getTopics(db: DB, projectId: string): Promise<Topic[]> {
  const { data, error } = await db.from("knowledge_topics").select("*").eq("project_id", projectId).order("sort_order");
  if (error) dbError(error, "getTopics");
  return data ?? [];
}

export async function getTopic(db: DB, id: string): Promise<Topic> {
  const { data, error } = await db.from("knowledge_topics").select("*").eq("id", id).maybeSingle();
  if (error) dbError(error, "getTopic");
  if (!data) throw notFound("Kunskapsområdet");
  return data;
}

export async function getReadyMaterials(db: DB, projectId: string): Promise<PromptMaterial[]> {
  const { data, error } = await db
    .from("source_materials")
    .select("id, category, type, filename, normalized_text")
    .eq("project_id", projectId)
    .eq("processing_status", "ready")
    .order("created_at");
  if (error) dbError(error, "getReadyMaterials");
  return (data ?? [])
    .filter((m) => m.normalized_text?.trim())
    .map((m) => ({ id: m.id, category: m.category, type: m.type, filename: m.filename, text: m.normalized_text! }));
}

type Evidence = { source_material_id: string; quote: string; verified: boolean };

export function topicEvidence(t: Pick<Topic, "evidence">): Evidence[] {
  return Array.isArray(t.evidence) ? (t.evidence as Evidence[]) : [];
}

export function toPromptTopic(t: Topic): PromptTopic {
  return {
    key: t.key,
    title: t.title,
    description: t.description,
    importance: t.importance,
    difficulty: t.difficulty,
    assessment_dimension: t.assessment_dimension,
    required_skills: t.required_skills,
    likely_question_types: t.likely_question_types,
    evidence_quotes: topicEvidence(t)
      .filter((e) => e.verified)
      .map((e) => e.quote)
      .slice(0, 4),
  };
}

/** Relevant excerpt of the student's material for one topic (verified quotes + surrounding text). */
export function materialExcerptFor(topic: Topic, materials: PromptMaterial[], budget = 8000): string | null {
  const parts: string[] = [];
  let used = 0;
  for (const e of topicEvidence(topic).filter((x) => x.verified)) {
    const m = materials.find((x) => x.id === e.source_material_id);
    if (!m) continue;
    const idx = m.text.toLowerCase().indexOf(e.quote.toLowerCase().slice(0, 40));
    const start = Math.max(0, idx - 600);
    const chunk = idx >= 0 ? m.text.slice(start, start + 1800) : e.quote;
    if (used + chunk.length > budget) break;
    parts.push(chunk);
    used += chunk.length;
  }
  if (parts.length === 0) {
    // Fall back to keyword search on the title.
    const word = topic.title.toLowerCase().split(/\s+/)[0];
    for (const m of materials) {
      const idx = m.text.toLowerCase().indexOf(word);
      if (idx >= 0) {
        parts.push(m.text.slice(Math.max(0, idx - 400), idx + 1600));
        break;
      }
    }
  }
  return parts.length ? parts.join("\n…\n") : null;
}
