import { apiRoute } from "@/lib/api/handler";
import { startAttempt } from "@/lib/services/mock-exams";

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => {
  const attempt = await startAttempt(supabase, params.id);
  return { attemptId: attempt.id, status: attempt.status };
});
