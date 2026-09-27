import "server-only";

import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { AIError } from "@/lib/ai/client";
import { ServiceError } from "@/lib/services/errors";
import { createClient, type DB } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type ApiErrorBody = { error: string; code: string; retryable: boolean };

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler: authenticates the user, validates the JSON body and
 * turns every thrown error into a friendly JSON error. AI failures never crash
 * the app – they come back as { error, code, retryable }.
 */
export function apiRoute<P extends Record<string, string>, S extends z.ZodType | undefined = undefined>(
  options: { body?: S },
  fn: (args: {
    params: P;
    body: S extends z.ZodType ? z.infer<S> : undefined;
    supabase: DB;
    user: User;
    request: Request;
  }) => Promise<unknown>,
) {
  return async (request: Request, ctx: Ctx<P>) => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        return NextResponse.json<ApiErrorBody>({ error: "Du är inte inloggad.", code: "unauthorized", retryable: false }, { status: 401 });
      }
      let body: unknown = undefined;
      if (options.body) {
        const json = await request.json().catch(() => ({}));
        body = options.body.parse(json);
      }
      const params = await ctx.params;
      const result = await fn({ params, body: body as never, supabase, user: data.user, request });
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof AIError) {
    const status = err.code === "not_configured" ? 503 : err.code === "rate_limited" ? 429 : 502;
    return NextResponse.json<ApiErrorBody>({ error: err.message, code: `ai_${err.code}`, retryable: err.retryable }, { status });
  }
  if (err instanceof ServiceError) {
    return NextResponse.json<ApiErrorBody>({ error: err.message, code: err.code, retryable: err.retryable }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json<ApiErrorBody>({ error: "Ogiltig förfrågan.", code: "bad_request", retryable: false }, { status: 400 });
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json<ApiErrorBody>({ error: "Något gick fel. Försök igen.", code: "internal", retryable: true }, { status: 500 });
}
