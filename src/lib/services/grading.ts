import "server-only";

import { gradeOpenAnswer } from "@/lib/ai/tasks/grade";
import { answerKindFor, type Answer, type Question } from "@/lib/domain/questions";
import { canGradeDeterministically, gradeDeterministic, type GradeResult } from "@/lib/engine/grading";
import { attemptWeight } from "@/lib/engine/mastery";
import type { DB } from "@/lib/supabase/server";
import { badRequest, dbError } from "./errors";

export function answerToText(answer: Answer): string {
  switch (answer.kind) {
    case "text":
      return answer.text;
    case "error_step":
      return `Steg ${answer.step + 1}. ${answer.text}`;
    case "choice":
      return `Alternativ ${answer.choice + 1}`;
    case "order":
      return answer.order.join(",");
    case "matches":
      return answer.matches.join(",");
  }
}

/** Deterministic grading when possible, AI analysis otherwise. */
export async function gradeAnswer(opts: {
  question: Question;
  answer: Answer;
  seed: string;
  subject: string;
  topicTitle: string;
}): Promise<GradeResult> {
  const { question, answer } = opts;
  if (answer.kind !== answerKindFor(question.type) && !(question.type === "short_answer" && answer.kind === "text")) {
    throw badRequest("Svaret har fel format för frågan.");
  }
  if (canGradeDeterministically(question, answer)) return gradeDeterministic(question, answer, opts.seed);
  return gradeOpenAnswer({ subject: opts.subject, topicTitle: opts.topicTitle, question, answer: answerToText(answer) });
}

export async function recordAttempt(
  db: DB,
  a: {
    projectId: string;
    topicId: string;
    source: "diagnostic" | "exercise" | "checkpoint" | "mock" | "remediation";
    sourceRef: string;
    question: Question;
    answer: Answer | null;
    grade: Pick<GradeResult, "score" | "is_correct" | "feedback" | "error_type" | "misconception" | "method">;
    weightMultiplier?: number;
  },
) {
  const { error } = await db.from("question_attempts").insert({
    project_id: a.projectId,
    topic_id: a.topicId,
    source: a.source,
    source_ref: a.sourceRef,
    question_id: a.question.id,
    question_type: a.question.type,
    answer: a.answer,
    score: a.grade.score,
    is_correct: a.grade.is_correct,
    weight: attemptWeight(a.question.type, a.question.difficulty) * (a.weightMultiplier ?? 1),
    feedback: a.grade.feedback,
    error_type: a.grade.error_type === "none" ? null : a.grade.error_type,
    misconception: a.grade.misconception,
    grading_method: a.grade.method,
  });
  if (error) dbError(error, "recordAttempt");
}
