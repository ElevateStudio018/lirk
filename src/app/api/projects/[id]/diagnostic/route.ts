import { apiRoute } from "@/lib/api/handler";
import { ensureDiagnostic } from "@/lib/services/diagnostic";

export const maxDuration = 300;

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => ensureDiagnostic(supabase, params.id));
