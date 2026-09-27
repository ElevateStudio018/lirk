import { apiRoute } from "@/lib/api/handler";
import { generatePlan } from "@/lib/services/plan";

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => generatePlan(supabase, params.id));
