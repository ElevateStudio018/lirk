import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

export default async function Home() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const user = await getUser();
  redirect(user ? "/dashboard" : "/login");
}
