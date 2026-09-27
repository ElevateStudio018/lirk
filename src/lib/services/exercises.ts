import "server-only";

import { generateExercises, type ExercisePurpose } from "@/lib/ai/tasks/questions";
import { Answer, Question, toPublicQuestion } from "@/lib/domain/questions";
import { correctAnswerText } from "@/lib/engine/grading";
import { confidenceMultiplier, type Confidence } from "@/lib/engine/mastery";
import type { DB } from "@/lib/supabase/server";
import { z } from "zod";
import { dbError, notFound } from "./errors";
import { gradeAnswer, recordAttempt } from "./grading";
import { recomputeMastery } from "./mastery";
import { getProject, getTopic, toPromptTopic } from "./projects";

export const EXERCISE_COUNT: Record<ExercisePurpose, number> = {
  practice: 4,
  review: 3,
  easier: 3,
  harder: 2,
  remediation: 3,
  confirmation: 1,
};

async function previousPrompts(db: DB, projectId: string, topicId: string) {
  const [{ data: sets }, { data: diag }] = await Promise.all([
    db.from("exercise_sets").select("items").eq("project_id", projectId).eq("topic_id", topicId),
    db.from("diagnostic_questions").select("question").eq("project_id", projectId).eq("topic_id", topicId),
  ]);
  const prompts: string[] = [];
  for (const s of sets ?? []) for (const q of z.array(Question).catch([]).parse(s.items)) prompts.push(q.prompt);
  for (const d of diag ?? []) {
    const q = Question.safeParse(d.question);
    if (q.success) prompts.push(q.data.prompt);
  }
  return prompts;
}

export async function createExerciseSet(
  db: DB,
  a: { projectId: string; topicId: string; sessionId: string | null; lessonId?: string | null; purpose: ExercisePurpose; focus: string | null },
) {
  const [project, topic] = await Promise.all([getProject(db, a.projectId), getTopic(db, a.topicId)]);
  let lessonSummary: string | null = null;
  if (a.lessonId) {
    const { data: scenes } = await db.from("lesson_scenes").select("data").eq("lesson_id", a.lessonId).order("position");
    lessonSummary = (scenes ?? [])
      .map((s) => (s.data as { headline?: string; narration?: string }))
      .map((s) => `- ${s.headline}: ${s.narration}`)
      .join("\n");
  }
  const questions = await generateExercises({
    subject: project.subject,
    topic: toPromptTopic(topic),
    count: EXERCISE_COUNT[a.purpose],
    purpose: a.purpose,
    focus: a.focus,
    lessonSummary,
    avoidPrompts: await previousPrompts(db, a.projectId, a.topicId),
  });
  const { data, error } = await db
    .from("exercise_sets")
    .insert({
      project_id: a.projectId,
      topic_id: a.topicId,
      session_id: a.sessionId,
      lesson_id: a.lessonId ?? null,
      purpose: a.purpose,
      items: questions.map((q) => ({ ...q, topic_key: topic.key })),
    })
    .select("id")
    .single();
  if (error) dbError(error, "createExerciseSet");
  return data.id;
}

export async function getExerciseSetView(db: DB, setId: string) {
  const { data: set, error } = await db.from("exercise_sets").select("*, knowledge_topics(title)").eq("id", setId).maybeSingle();
  if (error) dbError(error, "getExerciseSetView");
  if (!set) throw notFound("Övningen");
  const questions = z.array(Question).parse(set.items);
  const { data: attempts } = await db
    .from("question_attempts")
    .select("question_id, score, is_correct, feedback, answer")
    .eq("source_ref", setId)
    .order("created_at");
  const answered = new Map((attempts ?? []).map((a) => [a.question_id, a]));
  return {
    id: set.id,
    purpose: set.purpose,
    topicTitle: (set.knowledge_topics as { title: string } | null)?.title ?? "",
    questions: questions.map((q) => {
      const a = answered.get(q.id);
      return {
        question: toPublicQuestion(q, set.id),
        result: a
          ? { score: a.score, is_correct: a.is_correct, feedback: a.feedback ?? "", correct_answer: correctAnswerText(q), answer: a.answer }
          : null,
      };
    }),
  };
}

export async function answerExercise(db: DB, setId: string, questionId: string, answer: z.infer<typeof Answer>, confidence: Confidence | null = null) {
  const { data: set, error } = await db.from("exercise_sets").select("*, knowledge_topics(title)").eq("id", setId).maybeSingle();
  if (error) dbError(error, "answerExercise");
  if (!set || !set.topic_id) throw notFound("Övningen");
  const question = z.array(Question).parse(set.items).find((q) => q.id === questionId);
  if (!question) throw notFound("Frågan");

  const { data: existing } = await db
    .from("question_attempts")
    .select("score, is_correct, feedback, error_type, misconception")
    .eq("source_ref", setId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (existing) {
    return { ...existing, correct_answer: correctAnswerText(question), alreadyAnswered: true, mastery: null };
  }

  const project = await getProject(db, set.project_id);
  const grade = await gradeAnswer({
    question,
    answer,
    seed: set.id,
    subject: project.subject,
    topicTitle: (set.knowledge_topics as { title: string } | null)?.title ?? "",
  });
  const remediation = set.purpose === "remediation" || set.purpose === "confirmation";
  await recordAttempt(db, {
    projectId: set.project_id,
    topicId: set.topic_id,
    source: remediation ? "remediation" : "exercise",
    sourceRef: set.id,
    question,
    answer,
    grade,
    confidence,
    weightMultiplier: confidenceMultiplier(confidence, grade.is_correct),
  });
  const [estimate] = await recomputeMastery(db, [set.topic_id]);

  // Mark the set complete when every question has an answer.
  const { count } = await db.from("question_attempts").select("id", { count: "exact", head: true }).eq("source_ref", setId);
  if ((count ?? 0) >= z.array(Question).parse(set.items).length) {
    await db.from("exercise_sets").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", setId);
  }

  return { ...grade, alreadyAnswered: false, mastery: estimate };
}
