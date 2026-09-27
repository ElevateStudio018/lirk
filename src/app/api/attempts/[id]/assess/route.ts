import { apiRoute } from "@/lib/api/handler";
import { assessAttempt } from "@/lib/services/assessment";

export const maxDuration = 300;

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => assessAttempt(supabase, params.id));
