import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { completeItem } from "@/lib/services/sessions";

export const maxDuration = 60;

const Body = z.object({ itemId: z.string().min(1) });

export const POST = apiRoute<{ id: string }, typeof Body>({ body: Body }, async ({ supabase, params, body }) =>
  completeItem(supabase, params.id, body.itemId),
);
