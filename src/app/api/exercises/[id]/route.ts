import { apiRoute } from "@/lib/api/handler";
import { getExerciseSetView } from "@/lib/services/exercises";

export const GET = apiRoute<{ id: string }>({}, async ({ supabase, params }) => getExerciseSetView(supabase, params.id));
