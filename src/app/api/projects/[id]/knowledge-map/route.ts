import { apiRoute } from "@/lib/api/handler";
import { generateKnowledgeMap } from "@/lib/services/knowledge-map";

export const maxDuration = 300;

export const POST = apiRoute<{ id: string }>({}, async ({ supabase, params }) => generateKnowledgeMap(supabase, params.id));
