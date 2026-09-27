import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { Answer } from "@/lib/domain/questions";
import { answerDiagnostic } from "@/lib/services/diagnostic";

export const maxDuration = 90;

const Body = z.object({ questionId: z.string().uuid(), answer: Answer.nullable() });

export const POST = apiRoute<{ id: string }, typeof Body>({ body: Body }, async ({ supabase, params, body }) =>
  answerDiagnostic(supabase, params.id, body.questionId, body.answer),
);
