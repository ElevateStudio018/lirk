import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { saveAnswers } from "@/lib/services/mock-exams";

const Body = z.object({ answers: z.record(z.string(), z.unknown()) });

export const POST = apiRoute<{ id: string }, typeof Body>({ body: Body }, async ({ supabase, params, body }) =>
  saveAnswers(supabase, params.id, body.answers),
);
