import { apiRoute } from "@/lib/api/handler";
import { completeDiagnostic } from "@/lib/services/diagnostic";

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => completeDiagnostic(supabase, params.id));
