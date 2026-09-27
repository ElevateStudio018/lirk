import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { answerClarifying } from "@/lib/services/clarify";

const Body = z.object({ questionId: z.string().uuid(), answer: z.string().max(1000).nullable() });

export const POST = apiRoute<{ id: string }, typeof Body>({ body: Body }, async ({ supabase, params, body }) =>
  answerClarifying(supabase, params.id, body.questionId, body.answer),
);
