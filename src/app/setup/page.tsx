import { redirect } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Logo href="/setup" />
      <h1 className="mt-10 text-title font-bold text-ink">Appen behöver konfigureras</h1>
      <p className="mt-3 text-muted">Supabase-uppgifterna saknas. Lägg till dem i <code>.env.local</code> och starta om servern.</p>
      <Card className="mt-8 font-mono text-sm">
        <pre className="overflow-x-auto whitespace-pre">{`NEXT_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
OPENAI_API_KEY=<nyckel för AI-funktionerna>`}</pre>
      </Card>
      <p className="mt-6 text-sm text-muted">Se README.md för hur databasen och lagringen sätts upp.</p>
    </div>
  );
}
