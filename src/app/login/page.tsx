import type { Metadata } from "next";
import { BrainCircuit, CalendarCheck, PlayCircle } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logga in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 pb-10 pt-safe sm:px-12">
        <div className="py-6">
          <Logo href="/login" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <h1 className="text-title font-bold text-ink">Plugga smartare inför provet</h1>
          <p className="mb-8 mt-3 text-muted">Lägg in lärarens underlag – få en plan, korta lektioner och övningsprov som visar exakt vad du behöver träna på.</p>
          <LoginForm next={next} initialError={error === "auth" ? "Inloggningslänken var ogiltig eller har gått ut. Försök igen." : undefined} />
        </div>
      </div>
      <div className="hidden flex-col justify-center gap-6 px-16 lg:flex">
        {[
          { icon: BrainCircuit, title: "Vet exakt vad som kommer", text: "AI:n läser lärarens planering och betygskriterier och visar vad du behöver kunna." },
          { icon: CalendarCheck, title: "En plan som anpassar sig", text: "Varje dag vet du vad du ska göra – och planen ändras efter hur det går." },
          { icon: PlayCircle, title: "Korta visuella lektioner", text: "Förklaringar som rör sig, med frågor mitt i så att du hänger med." },
        ].map((f) => (
          <div key={f.title} className="glass flex max-w-md gap-5 rounded-xl p-6">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10">
              <f.icon className="size-6 text-ink" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">{f.title}</h2>
              <p className="mt-1 text-muted">{f.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
