import "server-only";

import { decideNext, type AdaptiveDecision, type DecisionContext } from "@/lib/engine/adaptive";
import type { PerformancePattern } from "@/lib/engine/mastery";
import { newItemId, parseItems, type SessionItem, type SessionItemInput, SessionItem as SessionItemSchema } from "@/lib/domain/session";
import type { ExercisePurpose } from "@/lib/ai/tasks/questions";
import type { DB } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { conflict, dbError, notFound } from "./errors";
import { createExerciseSet } from "./exercises";
import { createLesson, createMicroLesson } from "./lessons";
import { ensureMockExam } from "./mock-exams";
import { generatePlan } from "./plan";
import { getTopic, getTopics } from "./projects";

type SessionRow = Tables<"study_sessions">;

export async function getSession(db: DB, sessionId: string): Promise<SessionRow> {
  const { data, error } = await db.from("study_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) dbError(error, "getSession");
  if (!data) throw notFound("Passet");
  return data;
}

async function saveItems(db: DB, sessionId: string, items: SessionItem[], extra: Partial<SessionRow> = {}) {
  const current_step = Math.max(0, items.findIndex((i) => i.status === "pending"));
  const { error } = await db
    .from("study_sessions")
    .update({ items, current_step: current_step === -1 ? items.length : current_step, ...extra })
    .eq("id", sessionId);
  if (error) dbError(error, "saveItems");
}

export async function startSession(db: DB, sessionId: string) {
  const s = await getSession(db, sessionId);
  if (s.status === "pending") {
    const { error } = await db.from("study_sessions").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", sessionId);
    if (error) dbError(error, "startSession");
  }
  return { ok: true };
}

const PURPOSE_BY_KIND: Partial<Record<SessionItem["kind"], ExercisePurpose>> = {
  practice: "practice",
  review: "review",
  harder: "harder",
  easier: "easier",
  confirmation: "confirmation",
};

/** Gathers adaptive-engine input for a topic from the database. */
async function adaptiveInput(db: DB, session: SessionRow, items: SessionItem[], topicId: string, context: DecisionContext) {
  const topics = await getTopics(db, session.project_id);
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) throw notFound("Kunskapsområdet");
  const since = session.started_at ?? session.created_at;
  const { data: recent } = await db
    .from("question_attempts")
    .select("score, is_correct, error_type, misconception, source")
    .eq("topic_id", topicId)
    .in("source", ["exercise", "remediation", "checkpoint"])
    .gte("created_at", since)
    .order("created_at");
  const adaptiveItems = items.filter((i) => i.origin === "adaptive" && (i.topic_id === topicId || i.topic_ids.includes(topicId)));
  return {
    context,
    topic: {
      id: topic.id,
      title: topic.title,
      mastery: topic.mastery,
      confidence: topic.confidence,
      pattern: topic.performance_pattern as PerformancePattern,
      importance: topic.importance,
    },
    prerequisites: topics
      .filter((t) => topic.prerequisite_ids.includes(t.id))
      .map((t) => ({ id: t.id, title: t.title, mastery: t.mastery, confidence: t.confidence })),
    recent: (recent ?? [])
      .filter((r) => r.source !== "checkpoint")
      .map((r) => ({
        score: r.score,
        is_correct: r.is_correct,
        error_type: r.error_type,
        misconception: r.misconception,
        prerequisite_gap: r.error_type === "prerequisite",
      })),
    inserted: {
      micro: adaptiveItems.filter((i) => i.kind === "micro_lesson").length,
      easier: adaptiveItems.filter((i) => i.kind === "easier" || i.kind === "example").length,
      harder: adaptiveItems.filter((i) => i.kind === "harder").length,
      review: adaptiveItems.filter((i) => i.kind === "review").length,
    },
  };
}

async function logDecision(db: DB, session: SessionRow, topicId: string, d: AdaptiveDecision) {
  const { data, error } = await db
    .from("adaptive_decisions")
    .insert({
      project_id: session.project_id,
      session_id: session.id,
      topic_id: topicId,
      action: d.action,
      rule: d.rule,
      reason: d.reason,
      inputs: JSON.parse(JSON.stringify(d.inputs)),
    })
    .select("id")
    .single();
  if (error) dbError(error, "logDecision");
  return data.id;
}

function item(partial: SessionItemInput): SessionItem {
  return SessionItemSchema.parse(partial);
}

/**
 * Generates content for the current (first pending) item if needed.
 * Before a lesson the adaptive engine may decide to SKIP it.
 */
export async function prepareCurrentItem(db: DB, sessionId: string) {
  const session = await getSession(db, sessionId);
  let items = parseItems(session.items);
  if (session.status === "pending") await startSession(db, sessionId);
  let idx = items.findIndex((i) => i.status === "pending");
  if (idx === -1) return { item: null, decision: null };
  let current = items[idx];
  let decision: (AdaptiveDecision & { id: string }) | null = null;

  if (current.kind === "lesson" && current.topic_id && !current.ref_id) {
    const input = await adaptiveInput(db, session, items, current.topic_id, "before_lesson");
    const d = decideNext(input);
    if (d.action === "SKIP") {
      const id = await logDecision(db, session, current.topic_id, d);
      decision = { ...d, id };
      const topicId = current.topic_id;
      items = items.map((it, i) =>
        i === idx || (i > idx && it.status === "pending" && it.kind === "practice" && it.topic_id === topicId && it.origin === "plan")
          ? { ...it, status: "skipped" as const, decision_id: id }
          : it,
      );
      items.splice(idx + 1, 0, item({ id: newItemId(), kind: "harder", topic_id: topicId, topic_ids: [topicId], minutes: 4, label: `Utmaning: ${input.topic.title}`, origin: "adaptive", decision_id: id }));
      await saveItems(db, sessionId, items);
      idx = items.findIndex((i) => i.status === "pending");
      current = items[idx];
    }
  }

  if (!current.ref_id) {
    const ref = await createContent(db, session, items, current);
    items[idx] = { ...current, ref_id: ref };
    await saveItems(db, sessionId, items);
    current = items[idx];
  }
  return { item: current, decision };
}

async function createContent(db: DB, session: SessionRow, items: SessionItem[], it: SessionItem): Promise<string> {
  const pid = session.project_id;
  switch (it.kind) {
    case "lesson":
    case "example":
      if (it.origin === "adaptive" && it.focus) return createMicroLesson(db, pid, it.topic_id!, session.id, "easier_example", it.focus);
      return createLesson(db, pid, it.topic_id!, session.id, it.kind === "lesson" ? "lesson" : "example", it.focus);
    case "micro_lesson":
      return createMicroLesson(db, pid, it.topic_id!, session.id, "misconception", it.focus ?? "Vanliga missförstånd inom området");
    case "practice":
    case "review":
    case "harder":
    case "easier":
    case "confirmation": {
      const previousLesson = [...items].reverse().find((x) => x.status === "done" && x.kind === "lesson" && x.topic_id === it.topic_id);
      const purpose = it.origin === "remediation" && it.kind === "practice" ? "remediation" : PURPOSE_BY_KIND[it.kind]!;
      return createExerciseSet(db, {
        projectId: pid,
        topicId: it.topic_id!,
        sessionId: session.id,
        lessonId: previousLesson?.ref_id ?? null,
        purpose,
        focus: it.focus,
      });
    }
    case "mock_exam":
      return ensureMockExam(db, pid, "mock1");
    case "final_exam": {
      const openRemediation = items.some((x) => x.origin === "remediation" && x.status === "pending");
      if (openRemediation) throw conflict("Gör klart träningen först – sedan öppnas slutprovet.");
      return ensureMockExam(db, pid, "final");
    }
  }
}

/** Marks an item done, runs the adaptive engine and returns what happens next. */
export async function completeItem(db: DB, sessionId: string, itemId: string) {
  const session = await getSession(db, sessionId);
  const items = parseItems(session.items);
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) throw notFound("Aktiviteten");
  const it = items[idx];
  if (it.status !== "pending") return { decision: null, sessionCompleted: session.status === "completed" };
  if (it.kind === "mock_exam" || it.kind === "final_exam") throw conflict("Provet avslutas när du lämnar in det.");

  items[idx] = { ...it, status: "done" };
  let decision: (AdaptiveDecision & { id: string }) | null = null;

  const isPractice = ["practice", "review", "harder", "easier", "confirmation"].includes(it.kind);
  if (isPractice && it.topic_id) {
    const input = await adaptiveInput(db, session, items, it.topic_id, "after_practice");
    const d = decideNext(input);
    const id = await logDecision(db, session, it.topic_id, d);
    decision = { ...d, id };
    const inserts = adaptiveInserts(d, it, id, input.topic.title);
    if (d.action === "REVIEW") await scheduleReview(db, session, it.topic_id, input.topic.title, id, items, idx);
    items.splice(idx + 1, 0, ...inserts);
  }

  if (it.kind === "confirmation" && it.remediation_target_id) await resolveTarget(db, it);

  const done = items.every((i) => i.status !== "pending");
  await saveItems(db, sessionId, items, done ? { status: "completed", completed_at: new Date().toISOString() } : {});
  if (done) await replanQuietly(db, session.project_id);
  return { decision, sessionCompleted: done };
}

function adaptiveInserts(d: AdaptiveDecision, it: SessionItem, decisionId: string, topicTitle: string): SessionItem[] {
  const common = { origin: "adaptive" as const, decision_id: decisionId };
  switch (d.action) {
    case "MICRO_LESSON":
      return [
        item({ ...common, id: newItemId(), kind: "micro_lesson", topic_id: it.topic_id, topic_ids: [it.topic_id!], minutes: 2, label: "Mikrolektion", focus: d.focus }),
        item({ ...common, id: newItemId(), kind: "confirmation", topic_id: it.topic_id, topic_ids: [it.topic_id!], minutes: 2, label: "Kontrollfråga", focus: d.focus }),
      ];
    case "EASIER_EXAMPLE":
      return [
        item({ ...common, id: newItemId(), kind: "example", topic_id: d.targetTopicId, topic_ids: [d.targetTopicId], minutes: 2, label: "Ett enklare exempel", focus: d.focus ?? `Grunderna i ${topicTitle}` }),
        item({ ...common, id: newItemId(), kind: "easier", topic_id: d.targetTopicId, topic_ids: [d.targetTopicId], minutes: 4, label: "Enklare steg", focus: d.focus }),
      ];
    case "HARDER_QUESTION":
      return [item({ ...common, id: newItemId(), kind: "harder", topic_id: it.topic_id, topic_ids: [it.topic_id!], minutes: 4, label: `Utmaning: ${topicTitle}` })];
    default:
      return [];
  }
}

/** REVIEW: add a repetition of the topic to the next pending session (or at the end of this one). */
async function scheduleReview(db: DB, session: SessionRow, topicId: string, title: string, decisionId: string, items: SessionItem[], idx: number) {
  const review = item({ id: newItemId(), kind: "review", topic_id: topicId, topic_ids: [topicId], minutes: 4, label: `Repetera ${title}`, origin: "adaptive", decision_id: decisionId });
  const { data: next } = await db
    .from("study_sessions")
    .select("*")
    .eq("plan_id", session.plan_id)
    .eq("status", "pending")
    .in("kind", ["learn", "review"])
    .gt("position", session.position)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (next) {
    const nextItems = parseItems(next.items);
    if (!nextItems.some((i) => i.kind === "review" && i.topic_id === topicId)) {
      nextItems.unshift(review);
      await db
        .from("study_sessions")
        .update({ items: nextItems, estimated_minutes: next.estimated_minutes + 4, topic_ids: [...new Set([...next.topic_ids, topicId])] })
        .eq("id", next.id);
    }
  } else {
    items.splice(idx + 1, 0, review);
  }
}

async function resolveTarget(db: DB, it: SessionItem) {
  const { data: target } = await db.from("remediation_targets").select("*").eq("id", it.remediation_target_id!).maybeSingle();
  if (!target) return;
  const { data: attempts } = await db.from("question_attempts").select("is_correct").eq("source_ref", it.ref_id!);
  const topic = target.topic_id ? await getTopic(db, target.topic_id).catch(() => null) : null;
  const confirmed = (attempts ?? []).length > 0 && (attempts ?? []).every((a) => a.is_correct);
  const improved = topic?.mastery != null && target.baseline_mastery != null && topic.mastery >= target.baseline_mastery + 0.1;
  await db
    .from("remediation_targets")
    .update(confirmed || improved ? { status: "resolved", resolved_at: new Date().toISOString() } : { status: "in_progress" })
    .eq("id", target.id);
}

async function replanQuietly(db: DB, projectId: string) {
  try {
    await generatePlan(db, projectId);
  } catch (err) {
    console.warn("[plan] re-plan after session failed", err);
  }
}

/** Called when a mock exam attempt is submitted: marks the exam item done. */
export async function markExamItemDone(db: DB, projectId: string, mockExamId: string) {
  const { data: sessions } = await db.from("study_sessions").select("*").eq("project_id", projectId).in("kind", ["mock1", "remediation_final"]);
  for (const s of sessions ?? []) {
    const items = parseItems(s.items);
    const idx = items.findIndex((i) => (i.kind === "mock_exam" || i.kind === "final_exam") && i.ref_id === mockExamId);
    if (idx === -1) continue;
    items[idx] = { ...items[idx], status: "done" };
    const done = items.every((i) => i.status !== "pending");
    await saveItems(db, s.id, items, done ? { status: "completed", completed_at: new Date().toISOString() } : {});
  }
}
