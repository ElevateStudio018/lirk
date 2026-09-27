import "server-only";

import { parseItems } from "@/lib/domain/session";
import { addDays, todayISO } from "@/lib/engine/dates";
import { planStudy, type PlannerTopic } from "@/lib/engine/planner";
import type { DB } from "@/lib/supabase/server";
import { conflict, dbError } from "./errors";
import { getProject, getTopics, setProjectStatus } from "./projects";

/**
 * Creates the plan (first time) or re-plans all *pending* sessions from the
 * student's current mastery. Completed/in-progress sessions are never touched.
 */
export async function generatePlan(db: DB, projectId: string) {
  const project = await getProject(db, projectId);
  if (["collecting", "analyzing", "map_ready"].includes(project.status)) {
    throw conflict("Gör det diagnostiska testet först, så att planen kan anpassas efter dig.");
  }
  const topics = await getTopics(db, projectId);

  const { data: plan, error: planErr } = await db
    .from("study_plans")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .maybeSingle();
  if (planErr) dbError(planErr, "generatePlan.plan");

  const { data: sessions, error: sErr } = plan
    ? await db.from("study_sessions").select("*").eq("plan_id", plan.id).order("position")
    : { data: [], error: null };
  if (sErr) dbError(sErr, "generatePlan.sessions");

  // Never re-plan sessions that have started, nor the remediation session built from Mock Exam 1.
  const kept = (sessions ?? []).filter(
    (s) => s.status !== "pending" || (s.kind === "remediation_final" && parseItems(s.items).some((i) => i.origin === "remediation")),
  );
  const keptIds = new Set(kept.map((s) => s.id));
  const doneLessonTopics = new Set<string>();
  for (const s of kept) for (const it of parseItems(s.items)) if (it.kind === "lesson" && it.status !== "pending" && it.topic_id) doneLessonTopics.add(it.topic_id);

  const { data: exams } = await db.from("mock_exams").select("kind, exam_attempts(status)").eq("project_id", projectId);
  const mockSubmitted = (kind: string) =>
    (exams ?? []).some((e) => e.kind === kind && (e.exam_attempts as Array<{ status: string }>).some((a) => a.status !== "in_progress"));
  const mock1Kept = kept.some((s) => s.kind === "mock1");
  const finalKept = kept.some((s) => s.kind === "remediation_final");

  const today = todayISO();
  const studiedToday = kept.some((s) => s.completed_at && todayISO(new Date(s.completed_at)) === today);
  const startDate = studiedToday ? addDays(today, 1) : today;

  const plannerTopics: PlannerTopic[] = topics.map((t) => ({
    id: t.id,
    title: t.title,
    importance: t.importance,
    difficulty: t.difficulty,
    mastery: t.mastery,
    confidence: t.confidence,
    prerequisiteIds: t.prerequisite_ids,
    lessonDone: doneLessonTopics.has(t.id),
    lastPracticedAt: t.last_practiced_at,
  }));

  const result = planStudy({
    today: startDate,
    examDate: project.exam_date,
    availableDays: project.available_days,
    minutesPerSession: project.minutes_per_session,
    topics: plannerTopics,
    includeMock1: !mock1Kept && !mockSubmitted("mock1"),
    includeFinal: !finalKept && !mockSubmitted("final"),
  });

  let planId = plan?.id;
  const rationale = { priorities: result.priorities, dropped: result.dropped, notes: result.notes, generated_for: startDate };
  if (!planId) {
    const { data: created, error } = await db.from("study_plans").insert({ project_id: projectId, rationale }).select("id").single();
    if (error) dbError(error, "generatePlan.insertPlan");
    planId = created.id;
  } else {
    const { error } = await db
      .from("study_plans")
      .update({ rationale, version: (plan?.version ?? 1) + 1 })
      .eq("id", planId);
    if (error) dbError(error, "generatePlan.updatePlan");
    const pendingIds = (sessions ?? []).filter((s) => !keptIds.has(s.id)).map((s) => s.id);
    if (pendingIds.length) {
      const { error: delErr } = await db.from("study_sessions").delete().in("id", pendingIds);
      if (delErr) dbError(delErr, "generatePlan.deletePending");
    }
  }

  const offset = kept.reduce((max, s) => Math.max(max, s.position + 1), 0);
  if (result.sessions.length) {
    const { error } = await db.from("study_sessions").insert(
      result.sessions.map((s, i) => ({
        project_id: projectId,
        plan_id: planId!,
        position: offset + i,
        scheduled_date: s.scheduled_date,
        kind: s.kind,
        title: s.title,
        goal: s.goal,
        estimated_minutes: s.estimated_minutes,
        topic_ids: s.topic_ids,
        items: parseItems(s.items),
      })),
    );
    if (error) dbError(error, "generatePlan.insertSessions");
  }

  if (project.status === "diagnosed") await setProjectStatus(db, projectId, "studying");
  return { planId, sessions: result.sessions.length, notes: result.notes };
}

export async function getActivePlan(db: DB, projectId: string) {
  const { data: plan, error } = await db.from("study_plans").select("*").eq("project_id", projectId).eq("is_active", true).maybeSingle();
  if (error) dbError(error, "getActivePlan");
  if (!plan) return null;
  const { data: sessions, error: sErr } = await db.from("study_sessions").select("*").eq("plan_id", plan.id).order("position");
  if (sErr) dbError(sErr, "getActivePlan.sessions");
  return { plan, sessions: sessions ?? [] };
}
