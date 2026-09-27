import "server-only";

import { z } from "zod";
import { generateLesson, generateMicroLesson } from "@/lib/ai/tasks/lessons";
import { checkpointDecision, type CheckpointResult } from "@/lib/video/checkpoint";
import { Checkpoint, Scene, type Lesson } from "@/lib/video/schema";
import type { DB } from "@/lib/supabase/server";
import { dbError, notFound } from "./errors";
import { recordAttempt } from "./grading";
import { recomputeMastery } from "./mastery";
import { getProject, getReadyMaterials, getTopic, materialExcerptFor, toPromptTopic, type Project, type Topic } from "./projects";

async function saveLesson(
  db: DB,
  a: { project: Project; topic: Topic; sessionId: string | null; kind: "lesson" | "micro" | "example"; lesson: Pick<Lesson, "title" | "scenes" | "checkpoints"> },
) {
  const { data: module, error } = await db
    .from("lesson_modules")
    .insert({
      project_id: a.project.id,
      topic_id: a.topic.id,
      session_id: a.sessionId,
      kind: a.kind,
      title: a.lesson.title,
      checkpoints: a.lesson.checkpoints,
      status: "ready",
    })
    .select("id")
    .single();
  if (error) dbError(error, "saveLesson.module");
  const { error: scErr } = await db.from("lesson_scenes").insert(
    a.lesson.scenes.map((s, i) => ({ lesson_id: module.id, position: i, type: s.type, duration_seconds: s.duration, data: s })),
  );
  if (scErr) dbError(scErr, "saveLesson.scenes");
  return module.id;
}

export async function createLesson(db: DB, projectId: string, topicId: string, sessionId: string | null, kind: "lesson" | "example", focus: string | null) {
  const [project, topic, materials] = await Promise.all([getProject(db, projectId), getTopic(db, topicId), getReadyMaterials(db, projectId)]);
  const lesson = await generateLesson({
    subject: project.subject,
    topic: toPromptTopic(topic),
    kind,
    focus,
    materialExcerpt: materialExcerptFor(topic, materials),
  });
  return saveLesson(db, { project, topic, sessionId, kind, lesson });
}

export async function createMicroLesson(
  db: DB,
  projectId: string,
  topicId: string,
  sessionId: string | null,
  mode: "misconception" | "easier_example",
  focus: string,
) {
  const [project, topic] = await Promise.all([getProject(db, projectId), getTopic(db, topicId)]);
  const micro = await generateMicroLesson({ subject: project.subject, topic: toPromptTopic(topic), mode, focus });
  return saveLesson(db, {
    project,
    topic,
    sessionId,
    kind: mode === "misconception" ? "micro" : "example",
    lesson: { title: micro.title, scenes: micro.scenes, checkpoints: [] },
  });
}

export type PublicCheckpoint = Omit<Checkpoint, "correct_index" | "misconception_by_option" | "explanation">;

export async function getLessonView(db: DB, lessonId: string) {
  const { data: module, error } = await db.from("lesson_modules").select("*, knowledge_topics(title)").eq("id", lessonId).maybeSingle();
  if (error) dbError(error, "getLessonView");
  if (!module) throw notFound("Lektionen");
  const { data: sceneRows, error: sErr } = await db.from("lesson_scenes").select("data").eq("lesson_id", lessonId).order("position");
  if (sErr) dbError(sErr, "getLessonView.scenes");
  const scenes = (sceneRows ?? []).map((r) => Scene.parse(r.data));
  const checkpoints = z.array(Checkpoint).parse(module.checkpoints);
  return {
    id: module.id,
    title: module.title,
    kind: module.kind,
    topicTitle: (module.knowledge_topics as { title: string } | null)?.title ?? "",
    watchProgress: module.watch_progress,
    completed: Boolean(module.completed_at),
    scenes,
    checkpoints: checkpoints.map((c): PublicCheckpoint => ({ id: c.id, after_scene: c.after_scene, question: c.question, options: c.options, remedy_scenes: c.remedy_scenes })),
  };
}

export async function saveLessonProgress(db: DB, lessonId: string, progress: number, completed: boolean) {
  const { data: current } = await db.from("lesson_modules").select("watch_progress, completed_at").eq("id", lessonId).maybeSingle();
  if (!current) throw notFound("Lektionen");
  const { error } = await db
    .from("lesson_modules")
    .update({
      watch_progress: Math.max(current.watch_progress, Math.min(1, Math.max(0, progress))),
      completed_at: current.completed_at ?? (completed ? new Date().toISOString() : null),
    })
    .eq("id", lessonId);
  if (error) dbError(error, "saveLessonProgress");
}

export async function answerCheckpoint(db: DB, lessonId: string, checkpointId: string, choice: number, attempt: number): Promise<CheckpointResult> {
  const { data: module, error } = await db.from("lesson_modules").select("*").eq("id", lessonId).maybeSingle();
  if (error) dbError(error, "answerCheckpoint");
  if (!module) throw notFound("Lektionen");
  const cp = z.array(Checkpoint).parse(module.checkpoints).find((c) => c.id === checkpointId);
  if (!cp) throw notFound("Frågan");
  const result = checkpointDecision(cp, choice, attempt);

  // Only the first answer counts as evidence.
  if (attempt === 1 && module.topic_id) {
    await recordAttempt(db, {
      projectId: module.project_id,
      topicId: module.topic_id,
      source: "checkpoint",
      sourceRef: lessonId,
      question: {
        type: "mcq",
        id: cp.id,
        topic_key: "",
        prompt: cp.question,
        difficulty: 1,
        dimension: "understanding",
        options: cp.options,
        correct_index: cp.correct_index,
        explanation: cp.explanation,
        misconception_by_option: cp.misconception_by_option,
      },
      answer: { kind: "choice", choice },
      grade: {
        score: result.correct ? 1 : 0,
        is_correct: result.correct,
        feedback: cp.explanation,
        error_type: result.correct ? "none" : result.misconception ? "misconception" : "concept",
        misconception: result.misconception,
        method: "deterministic",
      },
    });
    await recomputeMastery(db, [module.topic_id]);
  }

  if (!result.correct) {
    await db.from("adaptive_decisions").insert({
      project_id: module.project_id,
      session_id: module.session_id,
      topic_id: module.topic_id,
      action: result.decision === "insert_micro_lesson" ? "MICRO_LESSON" : "CONTINUE",
      rule: result.misconception ? "CP_MISCONCEPTION" : attempt >= 2 ? "CP_REPEATED_ERROR" : "CP_SINGLE_ERROR",
      reason:
        result.decision === "insert_micro_lesson"
          ? "Svaret på kontrollfrågan visade en missuppfattning – en mikrolektion spelas upp direkt."
          : "Ett enstaka fel på kontrollfrågan – förklaringen visas och lektionen fortsätter.",
      inputs: { checkpoint_id: cp.id, choice, attempt, misconception: result.misconception },
    });
  }

  return {
    correct: result.correct,
    decision: result.decision,
    explanation: cp.explanation,
    correctOption: result.correct || attempt >= 2 ? cp.options[cp.correct_index] : null,
    misconception: result.misconception,
    remedyScenes: result.decision === "insert_micro_lesson" ? cp.remedy_scenes : [],
  };
}
