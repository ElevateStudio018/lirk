import "server-only";

import { buildKnowledgeMap } from "@/lib/ai/tasks/knowledge-map";
import type { DB } from "@/lib/supabase/server";
import { badRequest, conflict, dbError } from "./errors";
import { getProject, getReadyMaterials, setProjectStatus } from "./projects";

const REGENERATABLE = new Set(["collecting", "analyzing", "map_ready"]);

/** ANALYZE step: turns all ready materials into a verified knowledge map. */
export async function generateKnowledgeMap(db: DB, projectId: string) {
  const project = await getProject(db, projectId);
  if (!REGENERATABLE.has(project.status)) {
    throw conflict("Kunskapskartan kan inte göras om efter att du har börjat plugga, eftersom dina resultat hör ihop med den.");
  }
  const materials = await getReadyMaterials(db, projectId);
  if (materials.length === 0) throw badRequest("Lägg till minst ett material som har lästs in innan analysen.");

  await setProjectStatus(db, projectId, "analyzing");
  try {
    const map = await buildKnowledgeMap({
      subject: project.subject,
      title: project.title,
      targetGrade: project.target_grade,
      materials,
    });

    const { error: delErr } = await db.from("knowledge_topics").delete().eq("project_id", projectId);
    if (delErr) dbError(delErr, "knowledgeMap.delete");

    const { data: inserted, error: insErr } = await db
      .from("knowledge_topics")
      .insert(
        map.topics.map((t, i) => ({
          project_id: projectId,
          key: t.key,
          title: t.title,
          description: t.description,
          importance: t.importance,
          difficulty: t.difficulty,
          evidence_type: t.evidence_type,
          inference_reason: t.inference_reason,
          evidence: t.source_evidence,
          required_skills: t.required_skills,
          likely_question_types: t.likely_question_types,
          assessment_dimension: t.assessment_dimension,
          sort_order: i,
        })),
      )
      .select("id, key");
    if (insErr) dbError(insErr, "knowledgeMap.insert");

    const idByKey = new Map((inserted ?? []).map((r) => [r.key, r.id]));
    for (const t of map.topics) {
      const parent = t.parent_key ? idByKey.get(t.parent_key) : null;
      const prereqs = t.prerequisites.map((k) => idByKey.get(k)).filter((x): x is string => Boolean(x));
      if (parent || prereqs.length) {
        const { error } = await db
          .from("knowledge_topics")
          .update({ parent_id: parent ?? null, prerequisite_ids: prereqs })
          .eq("id", idByKey.get(t.key)!);
        if (error) dbError(error, "knowledgeMap.links");
      }
    }

    const hasCriteriaMaterial = materials.some((m) => m.category === "criteria");
    const { error: upErr } = await db
      .from("study_projects")
      .update({
        status: "map_ready",
        map_summary: map.summary,
        map_warnings: map.warnings,
        map_generated_at: new Date().toISOString(),
        has_grading_criteria: map.has_grading_criteria || hasCriteriaMaterial,
      })
      .eq("id", projectId);
    if (upErr) dbError(upErr, "knowledgeMap.project");

    // A new map invalidates any diagnostic and follow-up questions made for the old one.
    await db.from("diagnostic_questions").delete().eq("project_id", projectId);
    await db.from("clarifying_questions").delete().eq("project_id", projectId);
    await db.from("study_projects").update({ clarified_at: null }).eq("id", projectId);

    return { topics: map.topics.length };
  } catch (err) {
    const { count } = await db.from("knowledge_topics").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    await setProjectStatus(db, projectId, (count ?? 0) > 0 ? "map_ready" : "collecting");
    throw err;
  }
}
