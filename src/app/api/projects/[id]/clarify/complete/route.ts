import { apiRoute } from "@/lib/api/handler";
import { completeClarifying } from "@/lib/services/clarify";

export const maxDuration = 180;

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => completeClarifying(supabase, params.id));
