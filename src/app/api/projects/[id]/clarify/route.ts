import { apiRoute } from "@/lib/api/handler";
import { ensureClarifyingQuestions } from "@/lib/services/clarify";

export const maxDuration = 180;

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => ensureClarifyingQuestions(supabase, params.id));
