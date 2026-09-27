import { apiRoute } from "@/lib/api/handler";
import { getLessonView } from "@/lib/services/lessons";

export const GET = apiRoute<{ id: string }>({}, async ({ supabase, params }) => getLessonView(supabase, params.id));
