import "server-only";

import { z } from "zod";
import { assessMockExam, type AssessedQuestion, type QuestionAssessment } from "@/lib/ai/tasks/assessment";
import { Answer, Question, type Answer as AnswerT } from "@/lib/domain/questions";
import { newItemId, parseItems, SessionItem, type SessionItemInput } from "@/lib/domain/session";
import { addDays, todayISO } from "@/lib/engine/dates";
import { canGradeDeterministically, correctAnswerText, gradeDeterministic } from "@/lib/engine/grading";
import type { DB } from "@/lib/supabase/server";
import { conflict, dbError, notFound } from "./errors";
import { answerToText, recordAttempt } from "./grading";
import { recomputeMastery } from "./mastery";
import { getProject, getReadyMaterials, getTopics, setProjectStatus } from "./projects";

export type PerQuestionResult = QuestionAssessment & {
  position: number;
  prompt: string;
  type: string;
  topic_id: string | null;
  topic_title: string;
  points: number;
  earned: number;
  answer_text: string;
  correct_answer: string;
};

export type OverallAssessment = {
  strengths: string[];
  holding_back: string[];
  top_fixes: Array<{ title: string; description: string; topic_key: string | null }>;
  criteria_statement: string;
};

export type TopicScores = Record<string, { title: string; earned: number; max: number }>;

export async function assessAttempt(db: DB, attemptId: string) {
  const { data: attempt, error } = await db.from("exam_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (error) dbError(error, "assessAttempt.select");
  if (!attempt) throw notFound("Provförsöket");
  if (attempt.status === "in_progress") throw conflict("Provet måste lämnas in innan det kan bedömas.");

  const { data: existing } = await db.from("assessment_results").select("id").eq("attempt_id", attemptId).maybeSingle();
  if (existing) {
    if (attempt.status !== "assessed") await db.from("exam_attempts").update({ status: "assessed" }).eq("id", attemptId);
    return { assessmentId: existing.id };
  }

  await db.from("exam_attempts").update({ status: "assessing", error_message: null }).eq("id", attemptId);

  try {
    const { data: exam } = await db.from("mock_exams").select("*").eq("id", attempt.mock_exam_id).single();
    if (!exam) throw notFound("Provet");
    const { data: rows } = await db.from("mock_exam_questions").select("*").eq("mock_exam_id", exam.id).order("position");
    const [project, topics, materials] = await Promise.all([
      getProject(db, attempt.project_id),
      getTopics(db, attempt.project_id),
      getReadyMaterials(db, attempt.project_id),
    ]);
    const topicById = new Map(topics.map((t) => [t.id, t]));
    const answers = z.record(z.string(), Answer).catch({}).parse(attempt.answers);

    const questions = (rows ?? []).map((r) => {
      const question = Question.parse(r.question);
      const answer: AnswerT | undefined = answers[r.id];
      let deterministic: number | null = null;
      if (!answer) deterministic = 0;
      else if (canGradeDeterministically(question, answer)) deterministic = gradeDeterministic(question, answer, r.id).score;
      return { row: r, question, answer: answer ?? null, deterministic };
    });

    const assessed: AssessedQuestion[] = questions.map((q) => ({
      id: q.row.id,
      question: q.question,
      points: q.row.points,
      topicTitle: q.row.topic_id ? (topicById.get(q.row.topic_id)?.title ?? "") : "",
      answerText: q.answer ? answerToText(q.answer) : "",
      deterministicScore: q.deterministic,
    }));

    const result = await assessMockExam({
      subject: project.subject,
      examTitle: `${project.title} – ${exam.title}`,
      targetGrade: project.target_grade,
      criteria: materials.filter((m) => m.category === "criteria"),
      otherMaterials: materials.filter((m) => m.category !== "criteria"),
      questions: assessed,
    });

    const byQ = new Map(result.per_question.map((p) => [p.question_id, p]));
    const perQuestion: PerQuestionResult[] = questions.map((q, i) => {
      const ai = byQ.get(q.row.id);
      const fraction = q.deterministic ?? Math.min(1, Math.max(0, ai?.score_fraction ?? 0));
      const na = { level: "not_applicable" as const, comment: "" };
      return {
        question_id: q.row.id,
        score_fraction: fraction,
        correctness: ai?.correctness ?? na,
        understanding: ai?.understanding ?? na,
        method: ai?.method ?? na,
        reasoning: ai?.reasoning ?? na,
        terminology: ai?.terminology ?? na,
        completeness: ai?.completeness ?? na,
        misconceptions: ai?.misconceptions ?? [],
        feedback: ai?.feedback ?? (q.answer ? "" : "Frågan lämnades obesvarad."),
        source_refs: ai?.source_refs ?? [],
        position: i,
        prompt: q.question.prompt,
        type: q.question.type,
        topic_id: q.row.topic_id,
        topic_title: assessed[i].topicTitle,
        points: q.row.points,
        earned: Math.round(fraction * q.row.points * 10) / 10,
        answer_text: assessed[i].answerText,
        correct_answer: correctAnswerText(q.question),
      };
    });

    const topicScores: TopicScores = {};
    for (const p of perQuestion) {
      if (!p.topic_id) continue;
      topicScores[p.topic_id] ??= { title: p.topic_title, earned: 0, max: 0 };
      topicScores[p.topic_id].earned += p.earned;
      topicScores[p.topic_id].max += p.points;
    }
    const total = perQuestion.reduce((a, p) => a + p.earned, 0);
    const max = perQuestion.reduce((a, p) => a + p.points, 0);
    const overall: OverallAssessment = {
      strengths: result.strengths,
      holding_back: result.holding_back,
      top_fixes: result.top_fixes,
      criteria_statement: result.criteria_statement,
    };

    const { data: saved, error: insErr } = await db
      .from("assessment_results")
      .insert({
        project_id: attempt.project_id,
        attempt_id: attemptId,
        overall,
        per_question: perQuestion,
        topic_scores: topicScores,
        total_score: Math.round(total * 10) / 10,
        max_score: max,
        criteria_available: project.has_grading_criteria && materials.some((m) => m.category === "criteria"),
      })
      .select("id")
      .single();
    if (insErr) dbError(insErr, "assessAttempt.insert");

    // Mock answers are the strongest evidence for the mastery model.
    for (const q of questions) {
      if (!q.row.topic_id) continue;
      const p = perQuestion.find((x) => x.question_id === q.row.id)!;
      await recordAttempt(db, {
        projectId: attempt.project_id,
        topicId: q.row.topic_id,
        source: "mock",
        sourceRef: attemptId,
        question: q.question,
        answer: q.answer,
        grade: {
          score: p.score_fraction,
          is_correct: p.score_fraction >= 0.7,
          feedback: p.feedback,
          error_type: p.score_fraction >= 0.7 ? "none" : p.misconceptions.length ? "misconception" : "incomplete",
          misconception: p.misconceptions[0] ?? null,
          method: q.deterministic !== null ? "deterministic" : "ai",
        },
      });
    }
    await recomputeMastery(db, topics.map((t) => t.id));

    if (exam.kind === "mock1") {
      const refreshed = await getTopics(db, attempt.project_id);
      const byKey = new Map(refreshed.map((t) => [t.key, t]));
      const weakest = Object.entries(topicScores).sort((a, b) => a[1].earned / a[1].max - b[1].earned / b[1].max)[0]?.[0] ?? null;
      const targets = [...result.remediation_targets].sort((a, b) => b.priority - a.priority).slice(0, 5);
      const { data: createdTargets, error: tErr } = await db
        .from("remediation_targets")
        .insert(
          targets.map((t) => {
            const topic = (t.topic_key && byKey.get(t.topic_key)) || (weakest ? refreshed.find((x) => x.id === weakest) : undefined);
            return {
              project_id: attempt.project_id,
              assessment_id: saved.id,
              topic_id: topic?.id ?? null,
              priority: t.priority,
              title: t.title,
              description: t.description,
              baseline_mastery: topic?.mastery ?? null,
            };
          }),
        )
        .select("*");
      if (tErr) dbError(tErr, "assessAttempt.targets");
      await buildRemediationSession(db, attempt.project_id, createdTargets ?? [], project.minutes_per_session);
    }

    await db.from("exam_attempts").update({ status: "assessed", assessed_at: new Date().toISOString() }).eq("id", attemptId);
    if (exam.kind === "mock1" && ["studying", "diagnosed"].includes(project.status)) await setProjectStatus(db, project.id, "mock1_done");
    if (exam.kind === "final") await setProjectStatus(db, project.id, "final_done");
    return { assessmentId: saved.id };
  } catch (err) {
    await db
      .from("exam_attempts")
      .update({ status: "assessment_failed", error_message: err instanceof Error ? err.message : "Okänt fel" })
      .eq("id", attemptId);
    throw err;
  }
}

/**
 * Builds the "Targeted Remediation + Final Mock Exam" session from the targets:
 * per weakness a micro-lesson, active recall and a confirmation question; the
 * most important weakness also gets a worked example and a harder question.
 */
export async function buildRemediationSession(
  db: DB,
  projectId: string,
  targets: Array<{ id: string; topic_id: string | null; title: string; description: string; priority: number }>,
  minutesPerSession: number,
) {
  const usable = targets.filter((t) => t.topic_id).sort((a, b) => b.priority - a.priority).slice(0, minutesPerSession >= 30 ? 4 : 3);
  const items: SessionItemInput[] = [];
  usable.forEach((t, i) => {
    const focus = `${t.title}: ${t.description}`;
    const common = { topic_id: t.topic_id, topic_ids: [t.topic_id!], origin: "remediation" as const, focus, remediation_target_id: t.id };
    items.push({ ...common, id: newItemId(), kind: "micro_lesson", minutes: 2, label: `Mikrolektion: ${t.title}` });
    if (i === 0) items.push({ ...common, id: newItemId(), kind: "example", minutes: 3, label: `Exempel: ${t.title}` });
    items.push({ ...common, id: newItemId(), kind: "practice", minutes: 4, label: `Träna: ${t.title}` });
    if (i === 0) items.push({ ...common, id: newItemId(), kind: "harder", minutes: 3, label: `Svårare fråga: ${t.title}` });
    items.push({ ...common, id: newItemId(), kind: "confirmation", minutes: 2, label: `Kontrollfråga: ${t.title}` });
  });

  const { data: plan } = await db.from("study_plans").select("id").eq("project_id", projectId).eq("is_active", true).maybeSingle();
  if (!plan) return;
  const { data: session } = await db
    .from("study_sessions")
    .select("*")
    .eq("plan_id", plan.id)
    .eq("kind", "remediation_final")
    .neq("status", "completed")
    .maybeSingle();

  const parsed = items.map((i) => SessionItem.parse(i));
  if (session) {
    const existing = parseItems(session.items).filter((i) => i.origin !== "remediation");
    const finalItem = existing.find((i) => i.kind === "final_exam");
    const others = existing.filter((i) => i.kind !== "final_exam");
    const all = [...others, ...parsed, ...(finalItem ? [finalItem] : [])];
    const { error } = await db
      .from("study_sessions")
      .update({ items: all, estimated_minutes: all.reduce((a, i) => a + i.minutes, 0) })
      .eq("id", session.id);
    if (error) dbError(error, "buildRemediationSession.update");
  } else {
    const { data: last } = await db.from("study_sessions").select("position").eq("plan_id", plan.id).order("position", { ascending: false }).limit(1).maybeSingle();
    const project = await getProject(db, projectId);
    const tomorrow = addDays(todayISO(), 1);
    const all = [...parsed, SessionItem.parse({ id: newItemId(), kind: "final_exam", topic_id: null, minutes: 25, label: "Slutprov" })];
    const { error } = await db.from("study_sessions").insert({
      project_id: projectId,
      plan_id: plan.id,
      position: (last?.position ?? 0) + 1,
      scheduled_date: tomorrow < project.exam_date ? tomorrow : todayISO(),
      kind: "remediation_final",
      title: "Träna svagheter + slutprov",
      goal: "Träna på det som höll dig tillbaka i övningsprovet och gör sedan slutprovet.",
      estimated_minutes: all.reduce((a, i) => a + i.minutes, 0),
      topic_ids: [...new Set(usable.map((t) => t.topic_id!))],
      items: all,
    });
    if (error) dbError(error, "buildRemediationSession.insert");
  }
}

export async function getAssessment(db: DB, attemptId: string) {
  const { data, error } = await db.from("assessment_results").select("*").eq("attempt_id", attemptId).maybeSingle();
  if (error) dbError(error, "getAssessment");
  return data;
}
