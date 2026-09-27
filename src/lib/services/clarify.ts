import "server-only";

import { generateClarifyingQuestions, refineKnowledgeMap } from "@/lib/ai/tasks/clarify";
import { quoteOccursIn } from "@/lib/ai/material-context";
import { normalizeExtractedText } from "@/lib/materials/normalize";
import type { DB } from "@/lib/supabase/server";
import { badRequest, conflict, dbError, notFound } from "./errors";
import { getProject, getReadyMaterials, getTopics, toPromptTopic } from "./projects";

/** Följdfrågor happen between the knowledge map and the diagnostic test. */
function assertOpen(status: string) {
  if (status !== "map_ready") throw conflict("Följdfrågorna går bara att svara på innan det diagnostiska testet.");
}

export async function ensureClarifyingQuestions(db: DB, projectId: string) {
  const project = await getProject(db, projectId);
  assertOpen(project.status);
  const { data: existing } = await db.from("clarifying_questions").select("id").eq("project_id", projectId).limit(1);
  if (existing?.length) return { created: false };

  const [topics, materials] = await Promise.all([getTopics(db, projectId), getReadyMaterials(db, projectId)]);
  if (topics.length === 0) throw badRequest("Kunskapskartan är tom.");
  const questions = await generateClarifyingQuestions({
    subject: project.subject,
    title: project.title,
    targetGrade: project.target_grade,
    topics: topics.map(toPromptTopic),
    warnings: project.map_warnings,
    materials: materials.filter((m) => m.category !== "student_answers"),
  });
  const { error } = await db.from("clarifying_questions").insert(
    questions.map((q, i) => ({
      project_id: projectId,
      position: i,
      question: q.question,
      why: q.why,
      options: q.options,
      allow_free_text: q.allow_free_text,
      topic_keys: q.topic_keys,
    })),
  );
  if (error) dbError(error, "ensureClarifyingQuestions.insert");
  return { created: true };
}

export async function getClarifyingQuestions(db: DB, projectId: string) {
  const { data, error } = await db.from("clarifying_questions").select("*").eq("project_id", projectId).order("position");
  if (error) dbError(error, "getClarifyingQuestions");
  return data ?? [];
}

/** answer === null means "Vet inte". */
export async function answerClarifying(db: DB, projectId: string, questionId: string, answer: string | null) {
  const project = await getProject(db, projectId);
  assertOpen(project.status);
  const clean = answer?.trim().slice(0, 1000) || null;
  const { data, error } = await db
    .from("clarifying_questions")
    .update({ answer: clean, answered_at: new Date().toISOString() })
    .eq("id", questionId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();
  if (error) dbError(error, "answerClarifying");
  if (!data) throw notFound("Frågan");
  return { ok: true };
}

export type MapChange = { kind: "importance" | "removed" | "added"; title: string; detail: string };

/**
 * Saves the answers as their own material ("Dina svar") and lets the AI refine
 * the map. Every change is applied deterministically and returned so the
 * student can see exactly what changed and why.
 */
export async function completeClarifying(db: DB, projectId: string): Promise<{ summary: string | null; changes: MapChange[] }> {
  const project = await getProject(db, projectId);
  assertOpen(project.status);
  const questions = await getClarifyingQuestions(db, projectId);
  const qa = questions.filter((q) => q.answer).map((q) => ({ question: q.question, answer: q.answer! }));

  const finish = async () => {
    const { error } = await db.from("study_projects").update({ clarified_at: new Date().toISOString() }).eq("id", projectId);
    if (error) dbError(error, "completeClarifying.finish");
  };
  if (qa.length === 0) {
    await finish();
    return { summary: null, changes: [] };
  }

  // The answers become a traceable source, separate from the teacher's material.
  const text = normalizeExtractedText(qa.map((x) => `Fråga: ${x.question}\nMitt svar: ${x.answer}`).join("\n\n"));
  await db.from("source_materials").delete().eq("project_id", projectId).eq("category", "student_answers");
  const { data: material, error: mErr } = await db
    .from("source_materials")
    .insert({
      project_id: projectId,
      type: "paste",
      category: "student_answers",
      filename: "Dina svar på följdfrågorna",
      mime_type: "text/plain",
      extracted_text: text,
      normalized_text: text,
      extraction_method: "user-input",
      processing_status: "ready",
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (mErr) dbError(mErr, "completeClarifying.material");

  const topics = await getTopics(db, projectId);
  const refined = await refineKnowledgeMap({ subject: project.subject, topics: topics.map(toPromptTopic), qa });
  const byKey = new Map(topics.map((t) => [t.key, t]));
  const changes: MapChange[] = [];

  for (const u of refined.topic_updates) {
    const t = byKey.get(u.key);
    if (!t) continue;
    if (u.remove) {
      const { error } = await db.from("knowledge_topics").delete().eq("id", t.id);
      if (error) dbError(error, "completeClarifying.remove");
      changes.push({ kind: "removed", title: t.title, detail: u.reason });
    } else if (u.importance !== t.importance) {
      const { error } = await db.from("knowledge_topics").update({ importance: u.importance }).eq("id", t.id);
      if (error) dbError(error, "completeClarifying.importance");
      changes.push({ kind: "importance", title: t.title, detail: `${u.importance > t.importance ? "Viktigare" : "Mindre viktigt"}: ${u.reason}` });
    }
  }

  const maxOrder = topics.reduce((m, t) => Math.max(m, t.sort_order), 0);
  for (const [i, n] of refined.new_topics.entries()) {
    const verified = quoteOccursIn(n.quote, text);
    const { error } = await db.from("knowledge_topics").insert({
      project_id: projectId,
      key: n.key,
      title: n.title,
      description: n.description,
      importance: n.importance,
      difficulty: n.difficulty,
      evidence_type: verified ? "explicit" : "inferred",
      inference_reason: verified ? null : "Tillagt utifrån dina svar på följdfrågorna.",
      evidence: [{ source_material_id: material.id, quote: n.quote, verified }],
      assessment_dimension: n.assessment_dimension,
      sort_order: maxOrder + 1 + i,
    });
    if (error) dbError(error, "completeClarifying.add");
    changes.push({ kind: "added", title: n.title, detail: n.description });
  }

  // A diagnostic made for the old map would test the wrong things.
  await db.from("diagnostic_questions").delete().eq("project_id", projectId);
  await finish();
  return { summary: refined.summary, changes };
}
