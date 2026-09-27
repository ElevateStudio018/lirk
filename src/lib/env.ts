/**
 * Public (browser-safe) configuration. Only NEXT_PUBLIC_* values may be read here.
 * The Supabase service-role key is intentionally never referenced anywhere in the app:
 * every query runs as the signed-in user so Row Level Security always applies.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
};

export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
