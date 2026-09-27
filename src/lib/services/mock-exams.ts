import "server-only";

import { z } from "zod";
import { generateMockExam } from "@/lib/ai/tasks/mock-exam";
import { Answer, Question, toPublicQuestion } from "@/lib/domain/questions";
import type { DB } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { conflict, dbError, notFound } from "./errors";
import { getProject, getReadyMaterials, getTopics, toPromptTopic } from "./projects";

export type MockKind = "mock1" | "final";

async function seenPrompts(db: DB, projectId: string): Promise<string[]> {
  const [diag, sets, exams] = await Promise.all([
    db.from("diagnostic_questions").select("question").eq("project_id", projectId),
    db.from("exercise_sets").select("items").eq("project_id", projectId),
    db.from("mock_exams").select("mock_exam_questions(question)").eq("project_id", projectId),
  ]);
  const prompts: string[] = [];
  for (const d of diag.data ?? []) {
    const q = Question.safeParse(d.question);
    if (q.success) prompts.push(q.data.prompt);
  }
  for (const s of sets.data ?? []) for (const q of z.array(Question).catch([]).parse(s.items)) prompts.push(q.prompt);
  for (const e of exams.data ?? [])
    for (const row of (e.mock_exam_questions as Array<{ question: unknown }>) ?? []) {
      const q = Question.safeParse(row.question);
      if (q.success) prompts.push(q.data.prompt);
    }
  return prompts;
}

/** Returns the id of the project's mock exam of this kind, generating it first if needed. */
export async function ensureMockExam(db: DB, projectId: string, kind: MockKind): Promise<string> {
  const { data: existing, error } = await db.from("mock_exams").select("id").eq("project_id", projectId).eq("kind", kind).maybeSingle();
  if (error) dbError(error, "ensureMockExam.select");
  if (existing) return existing.id;

  if (kind === "final") {
    const { data: mock1 } = await db
      .from("mock_exams")
      .select("id, exam_attempts(status)")
      .eq("project_id", projectId)
      .eq("kind", "mock1")
      .maybeSingle();
    const assessed = (mock1?.exam_attempts as Array<{ status: string }> | undefined)?.some((a) => a.status === "assessed");
    if (!assessed) throw conflict("Slutprovet öppnas efter att övningsprov 1 är bedömt och du har tränat på svagheterna.");
  }

  const [project, topics, materials, avoid] = await Promise.all([
    getProject(db, projectId),
    getTopics(db, projectId),
    getReadyMaterials(db, projectId),
    seenPrompts(db, projectId),
  ]);
  const timeLimit = Math.round(Math.min(60, Math.max(20, project.minutes_per_session + 10)));
  const exam = await generateMockExam({
    subject: project.subject,
    title: project.title,
    kind,
    timeLimitMinutes: timeLimit,
    topics: topics.map((t) => ({ ...toPromptTopic(t), mastery: t.mastery })),
    materials,
    avoidPrompts: avoid,
  });
  const idByKey = new Map(topics.map((t) => [t.key, t.id]));

  const { data: created, error: insErr } = await db
    .from("mock_exams")
    .insert({
      project_id: projectId,
      kind,
      title: kind === "mock1" ? "Övningsprov 1" : "Slutprov",
      instructions: exam.instructions,
      time_limit_minutes: timeLimit,
      total_points: exam.questions.reduce((a, q) => a + q.points, 0),
    })
    .select("id")
    .single();
  if (insErr) {
    // Another request may have created it concurrently (unique project_id, kind).
    const { data: again } = await db.from("mock_exams").select("id").eq("project_id", projectId).eq("kind", kind).maybeSingle();
    if (again) return again.id;
    dbError(insErr, "ensureMockExam.insert");
  }

  const { error: qErr } = await db.from("mock_exam_questions").insert(
    exam.questions.map((q, i) => ({
      mock_exam_id: created.id,
      topic_id: idByKey.get(q.question.topic_key) ?? null,
      position: i,
      points: q.points,
      question: q.question,
      source_material_ids: q.source_material_ids,
    })),
  );
  if (qErr) {
    await db.from("mock_exams").delete().eq("id", created.id);
    dbError(qErr, "ensureMockExam.questions");
  }
  return created.id;
}

export async function getMockExamView(db: DB, mockExamId: string) {
  const { data: exam, error } = await db.from("mock_exams").select("*").eq("id", mockExamId).maybeSingle();
  if (error) dbError(error, "getMockExamView");
  if (!exam) throw notFound("Provet");
  const { data: rows, error: qErr } = await db.from("mock_exam_questions").select("*").eq("mock_exam_id", mockExamId).order("position");
  if (qErr) dbError(qErr, "getMockExamView.questions");
  const { data: attempts } = await db.from("exam_attempts").select("*").eq("mock_exam_id", mockExamId).order("started_at", { ascending: false });
  return {
    exam,
    questions: (rows ?? []).map((r) => ({ id: r.id, points: r.points, question: toPublicQuestion(Question.parse(r.question), r.id) })),
    attempt: attempts?.[0] ?? null,
  };
}

export async function startAttempt(db: DB, mockExamId: string) {
  const { data: exam } = await db.from("mock_exams").select("id, project_id").eq("id", mockExamId).maybeSingle();
  if (!exam) throw notFound("Provet");
  const { data: attempts } = await db.from("exam_attempts").select("*").eq("mock_exam_id", mockExamId).order("started_at", { ascending: false });
  if (attempts?.length) return attempts[0];
  const { data, error } = await db.from("exam_attempts").insert({ project_id: exam.project_id, mock_exam_id: mockExamId }).select().single();
  if (error) dbError(error, "startAttempt");
  return data;
}

const Answers = z.record(z.string(), Answer);

export async function saveAnswers(db: DB, attemptId: string, answers: Record<string, unknown>) {
  const parsed = Answers.parse(answers);
  const { data: attempt } = await db.from("exam_attempts").select("status, answers").eq("id", attemptId).maybeSingle();
  if (!attempt) throw notFound("Provförsöket");
  if (attempt.status !== "in_progress") throw conflict("Provet är redan inlämnat och kan inte ändras.");
  const merged = { ...(attempt.answers as Record<string, Json>), ...parsed } as Json;
  const { error } = await db.from("exam_attempts").update({ answers: merged }).eq("id", attemptId);
  if (error) dbError(error, "saveAnswers");
  return { saved: Object.keys(parsed).length };
}

/** Locks the attempt. Assessment runs separately afterwards. */
export async function submitAttempt(db: DB, attemptId: string, answers: Record<string, unknown>) {
  const { data: attempt } = await db.from("exam_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!attempt) throw notFound("Provförsöket");
  if (attempt.status !== "in_progress") return attempt;
  const merged = { ...(attempt.answers as Record<string, Json>), ...Answers.parse(answers) } as Json;
  const { error: saveErr } = await db.from("exam_attempts").update({ answers: merged }).eq("id", attemptId);
  if (saveErr) dbError(saveErr, "submitAttempt.save");
  const { data, error } = await db.from("exam_attempts").update({ status: "submitted" }).eq("id", attemptId).select().single();
  if (error) dbError(error, "submitAttempt.lock");
  const { markExamItemDone } = await import("./sessions");
  await markExamItemDone(db, attempt.project_id, attempt.mock_exam_id);
  return data;
}
