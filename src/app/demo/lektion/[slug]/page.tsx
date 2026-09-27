import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { equationsLesson } from "@/lib/video/samples/equations";
import { greenhouseLesson } from "@/lib/video/samples/greenhouse";
import { DemoPlayer } from "./demo-player";

const LESSONS = {
  vaxthuseffekten: { lesson: greenhouseLesson, subject: "Geografi åk 8" },
  ekvationer: { lesson: equationsLesson, subject: "Matematik" },
} as const;

export function generateStaticParams() {
  return Object.keys(LESSONS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = LESSONS[slug as keyof typeof LESSONS];
  return { title: entry ? `Testlektion: ${entry.lesson.title}` : "Testlektion" };
}

export default async function DemoLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = LESSONS[slug as keyof typeof LESSONS];
  if (!entry) notFound();
  return (
    <div className="mx-auto max-w-4xl px-5 pb-16 pt-safe sm:px-8">
      <div className="flex items-center justify-between py-6">
        <Logo href="/" />
        <Link href="/login" className="text-sm font-semibold text-muted hover:text-ink">
          Logga in
        </Link>
      </div>
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">Testlektion · {entry.subject}</p>
      <h1 className="mt-1 text-title font-bold text-ink sm:text-display">{entry.lesson.title}</h1>
      <p className="mb-8 mt-3 max-w-2xl text-muted">
        Lektionen är byggd helt från strukturerade scener (JSON) och renderas med React – samma format som AI:n skriver för dina egna lektioner. Svara
        fel på en kontrollfråga för att se en mikrolektion.
      </p>
      <DemoPlayer slug={slug} />
      <nav className="mt-10 flex flex-wrap gap-2" aria-label="Fler testlektioner">
        {Object.entries(LESSONS).map(([s, e]) => (
          <Link
            key={s}
            href={`/demo/lektion/${s}`}
            className={cn("rounded-full border px-4 py-2 text-sm font-semibold", s === slug ? "border-ink bg-primary text-on-primary" : "border-border bg-surface text-muted hover:text-ink")}
          >
            {e.lesson.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
