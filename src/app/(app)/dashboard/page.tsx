import type { Metadata } from "next";
import { CalendarDays, PlayCircle, Plus } from "lucide-react";
import Link from "next/link";
import { NextStepCard } from "@/components/study/next-step-card";
import { ReadinessCard } from "@/components/study/readiness-card";
import { StatusLegend, TopicChips } from "@/components/study/topic-status";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { friendlyDate, todayISO } from "@/lib/engine/dates";
import { listOverviews } from "@/lib/services/overview";
import { requireUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Idag" };

function daysLeftText(days: number) {
  if (days === 0) return "Provet är idag";
  if (days === 1) return "1 dag kvar";
  return `${days} dagar kvar`;
}

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const [{ upcoming }, { data: profile }] = await Promise.all([
    listOverviews(supabase),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  const name = profile?.display_name;

  if (upcoming.length === 0) {
    return (
      <>
        <h1 className="mb-8 text-title font-bold text-ink sm:text-display">{name ? `Hej ${name}!` : "Hej!"}</h1>
        <EmptyState
          icon={CalendarDays}
          title="Har du ett prov på gång?"
          description="Lägg in provet och lärarens underlag, så bygger vi en plan som visar vad du ska göra varje dag."
          action={
            <div className="flex flex-col items-center gap-3">
              <Link href="/exams/new" className={buttonVariants({ size: "lg", variant: "brand" })}>
                <Plus /> Jag har ett prov
              </Link>
              <Link href="/demo/lektion/vaxthuseffekten" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <PlayCircle /> Se hur en lektion ser ut
              </Link>
            </div>
          }
        />
      </>
    );
  }

  const [main, ...others] = upcoming;
  const measuredTopics = main.topicStatus.length > 0;

  return (
    <div className="flex flex-col gap-10">
      {/* Days Since-style hero: one huge number, everything else quiet. */}
      <section className="flex items-end justify-between gap-6 pt-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{main.project.subject}</p>
          <h1 className="mt-2 text-title font-bold text-ink sm:text-display">{main.project.title}</h1>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-[5.5rem] font-extrabold leading-[0.85] tracking-[-0.06em] tabular-nums sm:text-[7rem]", main.daysLeft <= 2 ? "text-ink" : "text-ink/90")}>
            {Math.max(0, main.daysLeft)}
          </p>
          <p className="mt-2 text-sm font-semibold text-muted">{main.daysLeft === 0 ? "provet är idag" : main.daysLeft === 1 ? "dag kvar" : "dagar kvar"}</p>
        </div>
      </section>

      <NextStepCard step={main.next} eyebrow={main.next.kind === "session" && main.nextSession && main.nextSession.scheduled_date <= todayISO() ? "Dagens pass" : main.next.kind === "session" ? "Nästa pass" : "Nästa steg"} />

      {measuredTopics && (
        <section className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div>
            <SectionHeader
              title="Kunskapsområden"
              action={
                <Link href={`/exams/${main.project.id}/map`} className="text-sm font-semibold text-muted hover:text-ink">
                  Visa alla
                </Link>
              }
            />
            <TopicChips topics={main.topicStatus} />
            <div className="mt-4">
              <StatusLegend />
            </div>
          </div>
          <div>
            <SectionHeader title="Läget" />
            <ReadinessCard readiness={main.readiness} />
          </div>
        </section>
      )}

      {main.sessions.length > 0 && (
        <section>
          <SectionHeader
            title="Din plan"
            action={
              <Link href={`/exams/${main.project.id}/plan`} className="text-sm font-semibold text-muted hover:text-ink">
                Hela planen
              </Link>
            }
          />
          <ul className="flex flex-col divide-y divide-border glass rounded-card">
            {main.sessions
              .filter((s) => s.status !== "completed")
              .slice(0, 4)
              .map((s) => (
                <li key={s.id}>
                  <Link href={`/study/${s.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.07]">
                    <span className="w-20 shrink-0 text-sm font-semibold text-muted">{friendlyDate(s.scheduled_date)}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{s.title}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">{s.estimated_minutes} min</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <SectionHeader title="Andra prov" />
          <div className="grid gap-3 sm:grid-cols-2">
            {others.map((o) => (
              <Link key={o.project.id} href={`/exams/${o.project.id}`}>
                <Card interactive>
                  <p className="text-sm font-semibold text-muted">{o.project.subject}</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{o.project.title}</p>
                  <p className="mt-2 text-sm text-muted">
                    {daysLeftText(o.daysLeft)} · {o.next.title}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
