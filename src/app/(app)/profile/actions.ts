"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";

export type ProfileState = { ok?: boolean; error?: string };

export async function updateProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = z.object({ name: z.string().trim().min(1, "Skriv ditt namn.").max(60) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { user, supabase } = await requireUser();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.name }).eq("id", user.id);
  if (error) return { error: "Kunde inte spara. Försök igen." };
  revalidatePath("/", "layout");
  return { ok: true };
}
