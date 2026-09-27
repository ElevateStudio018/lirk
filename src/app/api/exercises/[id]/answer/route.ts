import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { Answer } from "@/lib/domain/questions";
import { answerExercise } from "@/lib/services/exercises";

export const maxDuration = 90;

const Body = z.object({ questionId: z.string(), answer: Answer, confidence: z.enum(["sure", "think", "guess"]).nullable().optional() });

export const POST = apiRoute<{ id: string }, typeof Body>({ body: Body }, async ({ supabase, params, body }) =>
  answerExercise(supabase, params.id, body.questionId, body.answer, body.confidence ?? null),
);
