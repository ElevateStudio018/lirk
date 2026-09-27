import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { saveLessonProgress } from "@/lib/services/lessons";

const Body = z.object({ progress: z.number().min(0).max(1), completed: z.boolean() });

export const POST = apiRoute<{ id: string }, typeof Body>({ body: Body }, async ({ supabase, params, body }) =>
  saveLessonProgress(supabase, params.id, body.progress, body.completed),
);
