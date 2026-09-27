import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

export type DB = Awaited<ReturnType<typeof createClient>>;

/** Server Supabase client bound to the current request's auth cookies. RLS applies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component – the proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

/** Returns the verified user (validated against Supabase Auth) or null. Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** For pages/actions that require a signed-in user. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  return { user, supabase };
}
