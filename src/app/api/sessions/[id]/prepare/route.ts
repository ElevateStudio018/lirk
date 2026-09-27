import { apiRoute } from "@/lib/api/handler";
import { prepareCurrentItem } from "@/lib/services/sessions";

export const maxDuration = 300;

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => prepareCurrentItem(supabase, params.id));
