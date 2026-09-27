import "server-only";

import { daysBetween, todayISO } from "@/lib/engine/dates";
import { masteryStatus } from "@/lib/engine/mastery";
import { nextStep, type ProjectStatus } from "@/lib/engine/next-step";
import { computeReadiness } from "@/lib/engine/readiness";
import type { DB } from "@/lib/supabase/server";
import { dbError } from "./errors";
import { getProject, getTopics, type Project, type Topic } from "./projects";

export type Overview = Awaited<ReturnType<typeof getProjectOverview>>;

export async function getProjectOverview(db: DB, projectId: string) {
  const project = await getProject(db, projectId);
  return buildOverview(db, project);
}

async function buildOverview(db: DB, project: Project) {
  const [topics, materials, diagnostic, sessions, reviews] = await Promise.all([
    getTopics(db, project.id),
    db.from("source_materials").select("processing_status").eq("project_id", project.id),
    db.from("diagnostic_questions").select("answered_at").eq("project_id", project.id),
    db
      .from("study_sessions")
      .select("id, title, estimated_minutes, scheduled_date, kind, status, position, study_plans!inner(is_active)")
      .eq("project_id", project.id)
      .eq("study_plans.is_active", true)
      .order("position"),
    db.from("question_attempts").select("topic_id, is_correct, source").eq("project_id", project.id).in("source", ["exercise", "remediation"]),
  ]);
  if (materials.error) dbError(materials.error, "overview.materials");

  const mats = materials.data ?? [];
  const diag = diagnostic.data ?? [];
  const allSessions = sessions.data ?? [];
  const next =
    allSessions.find((s) => s.status === "in_progress") ?? allSessions.find((s) => s.status === "pending") ?? null;

  const successfulReviews = new Map<string, number>();
  for (const a of reviews.data ?? []) if (a.is_correct) successfulReviews.set(a.topic_id, (successfulReviews.get(a.topic_id) ?? 0) + 1);

  const readiness = computeReadiness(
    topics.map((t) => ({
      id: t.id,
      title: t.title,
      importance: t.importance,
      mastery: t.mastery,
      confidence: t.confidence,
      lastPracticedAt: t.last_practiced_at,
      successfulReviews: Math.floor((successfulReviews.get(t.id) ?? 0) / 3),
    })),
  );

  const today = todayISO();
  return {
    project,
    topics,
    topicStatus: topics.map((t) => ({ ...t, status: masteryStatus(t.mastery, t.confidence) })),
    daysLeft: daysBetween(today, project.exam_date),
    materialCounts: {
      total: mats.length,
      ready: mats.filter((m) => m.processing_status === "ready").length,
      processing: mats.filter((m) => m.processing_status === "processing" || m.processing_status === "uploaded").length,
      failed: mats.filter((m) => m.processing_status === "failed").length,
    },
    sessions: allSessions,
    completedSessions: allSessions.filter((s) => s.status === "completed").length,
    nextSession: next,
    readiness,
    next: nextStep({
      projectId: project.id,
      status: project.status as ProjectStatus,
      readyMaterials: mats.filter((m) => m.processing_status === "ready").length,
      processingMaterials: mats.filter((m) => m.processing_status === "processing" || m.processing_status === "uploaded").length,
      diagnosticAnswered: diag.filter((d) => d.answered_at).length,
      diagnosticTotal: diag.length,
      clarified: Boolean(project.clarified_at),
      nextSession: next,
    }),
  };
}

export async function listOverviews(db: DB) {
  const { data, error } = await db.from("study_projects").select("*").neq("status", "archived").order("exam_date");
  if (error) dbError(error, "listOverviews");
  const today = todayISO();
  const projects = data ?? [];
  const upcoming = projects.filter((p) => p.exam_date >= today);
  const past = projects.filter((p) => p.exam_date < today);
  return { upcoming: await Promise.all(upcoming.map((p) => buildOverview(db, p))), past };
}

export type TopicWithStatus = Topic & { status: ReturnType<typeof masteryStatus> };
