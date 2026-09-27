"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const Credentials = z.object({
  email: z.string().trim().email("Ange en giltig e-postadress."),
  password: z.string().min(8, "Lösenordet måste vara minst 8 tecken."),
  next: z.string().optional(),
});

function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function siteUrl() {
  if (publicEnv.siteUrl) return publicEnv.siteUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function translate(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Fel e-post eller lösenord.";
  if (/email not confirmed/i.test(message)) return "Bekräfta din e-post först – kolla inkorgen.";
  if (/already registered/i.test(message)) return "Det finns redan ett konto med den e-posten. Logga in i stället.";
  if (/rate limit/i.test(message)) return "För många försök. Vänta en stund och försök igen.";
  return "Något gick fel. Försök igen.";
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: translate(error.message) };
  redirect(safeNext(parsed.data.next));
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = Credentials.extend({ name: z.string().trim().max(60).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback`,
      data: parsed.data.name ? { display_name: parsed.data.name } : undefined,
    },
  });
  if (error) return { error: translate(error.message) };
  if (!data.session) return { message: "Klart! Vi har skickat ett mejl – klicka på länken för att bekräfta kontot." };
  redirect("/dashboard");
}

export async function sendMagicLink(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email: z.string().trim().email("Ange en giltig e-postadress.") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback` },
  });
  if (error) return { error: translate(error.message) };
  return { message: "Kolla din inkorg – vi har skickat en inloggningslänk." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
