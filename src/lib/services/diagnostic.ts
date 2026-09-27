import "server-only";

import { generateDiagnostic } from "@/lib/ai/tasks/questions";
import { Question, toPublicQuestion, type Answer } from "@/lib/domain/questions";
import { masteryStatus } from "@/lib/engine/mastery";
import type { DB } from "@/lib/supabase/server";
import { badRequest, conflict, dbError, notFound } from "./errors";
import { gradeAnswer, recordAttempt } from "./grading";
import { recomputeMastery } from "./mastery";
import { getProject, getTopics, setProjectStatus, toPromptTopic } from "./projects";

export async function ensureDiagnostic(db: DB, projectId: string) {
  const project = await getProject(db, projectId);
  if (project.status === "collecting" || project.status === "analyzing") {
    throw conflict("Kunskapskartan måste vara klar innan testet.");
  }
  const { data: existing, error } = await db.from("diagnostic_questions").select("id").eq("project_id", projectId).limit(1);
  if (error) dbError(error, "ensureDiagnostic.select");
  if (existing && existing.length) return { created: false };

  const topics = await getTopics(db, projectId);
  if (topics.length === 0) throw badRequest("Kunskapskartan är tom.");
  const questions = await generateDiagnostic({ subject: project.subject, title: project.title, topics: topics.map(toPromptTopic) });
  const idByKey = new Map(topics.map((t) => [t.key, t.id]));

  const rows = questions
    .filter((q) => idByKey.has(q.topic_key))
    .map((q, i) => ({ project_id: projectId, topic_id: idByKey.get(q.topic_key)!, position: i, question: q }));
  const { error: insErr } = await db.from("diagnostic_questions").insert(rows);
  if (insErr) dbError(insErr, "ensureDiagnostic.insert");
  return { created: true };
}

export async function getDiagnosticForStudent(db: DB, projectId: string) {
  const { data, error } = await db
    .from("diagnostic_questions")
    .select("id, topic_id, position, question, answered_at")
    .eq("project_id", projectId)
    .order("position");
  if (error) dbError(error, "getDiagnostic");
  return (data ?? []).map((row) => {
    const q = Question.parse(row.question);
    return {
      id: row.id,
      topic_id: row.topic_id,
      answered: Boolean(row.answered_at),
      difficulty: q.difficulty,
      question: toPublicQuestion(q, row.id),
    };
  });
}

export async function answerDiagnostic(db: DB, projectId: string, questionRowId: string, answer: Answer | null) {
  const project = await getProject(db, projectId);
  const { data: row, error } = await db
    .from("diagnostic_questions")
    .select("*, knowledge_topics(title)")
    .eq("id", questionRowId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) dbError(error, "answerDiagnostic.select");
  if (!row) throw notFound("Frågan");
  if (row.answered_at) return { ok: true, alreadyAnswered: true };

  const question = Question.parse(row.question);
  const topicTitle = (row.knowledge_topics as { title: string } | null)?.title ?? "";
  // "Vet inte" is honest evidence: it counts as a wrong answer but without AI analysis.
  const grade = answer
    ? await gradeAnswer({ question, answer, seed: row.id, subject: project.subject, topicTitle })
    : { score: 0, is_correct: false, feedback: "Vet inte", error_type: "incomplete" as const, misconception: null, method: "deterministic" as const };

  await recordAttempt(db, {
    projectId,
    topicId: row.topic_id,
    source: "diagnostic",
    sourceRef: row.id,
    question,
    answer,
    grade,
  });
  const { error: upErr } = await db.from("diagnostic_questions").update({ answered_at: new Date().toISOString() }).eq("id", row.id);
  if (upErr) dbError(upErr, "answerDiagnostic.update");
  return { ok: true, alreadyAnswered: false };
}

export async function completeDiagnostic(db: DB, projectId: string) {
  const project = await getProject(db, projectId);
  const { data: questions, error } = await db.from("diagnostic_questions").select("answered_at").eq("project_id", projectId);
  if (error) dbError(error, "completeDiagnostic.select");
  if (!questions?.length) throw badRequest("Testet finns inte.");
  if (questions.some((q) => !q.answered_at)) throw badRequest("Svara på alla frågor först.");

  const topics = await getTopics(db, projectId);
  const estimates = await recomputeMastery(db, topics.map((t) => t.id));
  if (project.status === "map_ready") await setProjectStatus(db, projectId, "diagnosed");
  return summarize(topics, estimates);
}

export function summarize(
  topics: Array<{ id: string; title: string; importance: number }>,
  estimates: Array<{ topic_id: string; mastery: number | null; confidence: number }>,
) {
  const byId = new Map(estimates.map((e) => [e.topic_id, e]));
  const rows = topics.map((t) => {
    const e = byId.get(t.id);
    return { id: t.id, title: t.title, importance: t.importance, status: masteryStatus(e?.mastery ?? null, e?.confidence ?? 0), mastery: e?.mastery ?? null };
  });
  return {
    strong: rows.filter((r) => r.status === "good").map((r) => r.title),
    needsHelp: rows
      .filter((r) => r.status === "bad" || r.status === "warn")
      .sort((a, b) => b.importance - a.importance || (a.mastery ?? 0) - (b.mastery ?? 0))
      .map((r) => r.title),
    unsure: rows.filter((r) => r.status === "unknown").map((r) => r.title),
  };
}
