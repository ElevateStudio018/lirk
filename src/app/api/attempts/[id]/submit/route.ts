import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { submitAttempt } from "@/lib/services/mock-exams";

const Body = z.object({ answers: z.record(z.string(), z.unknown()) });

export const POST = apiRoute<{ id: string }, typeof Body>({ body: Body }, async ({ supabase, params, body }) => {
  const attempt = await submitAttempt(supabase, params.id, body.answers);
  return { attemptId: attempt.id, status: attempt.status };
});
