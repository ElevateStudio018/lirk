import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { answerCheckpoint } from "@/lib/services/lessons";

const Body = z.object({ checkpointId: z.string(), choice: z.number().int().min(0), attempt: z.number().int().min(1).max(5) });

export const POST = apiRoute<{ id: string }, typeof Body>({ body: Body }, async ({ supabase, params, body }) =>
  answerCheckpoint(supabase, params.id, body.checkpointId, body.choice, body.attempt),
);
