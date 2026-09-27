import { apiRoute } from "@/lib/api/handler";
import { processMaterial } from "@/lib/services/materials";

export const maxDuration = 120;

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => {
  const m = await processMaterial(supabase, params.id);
  return { id: m.id, status: m.processing_status, error: m.error_message };
});
