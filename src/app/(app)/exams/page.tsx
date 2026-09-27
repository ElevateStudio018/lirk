import type { Metadata } from "next";
import { BookOpenCheck, Plus } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { longDate } from "@/lib/engine/dates";
import { listOverviews } from "@/lib/services/overview";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mina prov" };

export default async function ExamsPage() {
  const { supabase } = await requireUser();
  const { upcoming, past } = await listOverviews(supabase);
  return (
    <>
      <PageHeader
        title="Mina prov"
        actions={
          <Link href="/exams/new" className={buttonVariants({ variant: "primary" })}>
            <Plus /> Nytt prov
          </Link>
        }
      />
      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="Inga prov ännu"
          description="Skapa ditt första prov så hjälper vi dig att plugga inför det."
          action={
            <Link href="/exams/new" className={buttonVariants({ variant: "brand", size: "lg" })}>
              <Plus /> Jag har ett prov
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((o) => (
              <Link key={o.project.id} href={`/exams/${o.project.id}`}>
                <Card interactive className="h-full">
                  <p className="text-sm font-semibold text-muted">{o.project.subject}</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-ink">{o.project.title}</p>
                  <p className="mt-1 text-sm text-muted">{longDate(o.project.exam_date)}</p>
                  {o.sessions.length > 0 && (
                    <div className="mt-5">
                      <ProgressBar value={o.completedSessions / o.sessions.length} size="sm" aria-label="Avklarade pass" />
                      <p className="mt-2 text-xs text-muted">
                        {o.completedSessions} av {o.sessions.length} pass klara
                      </p>
                    </div>
                  )}
                  <p className="mt-4 text-sm font-semibold text-ink">{o.next.title} →</p>
                </Card>
              </Link>
            ))}
          </div>
          {past.length > 0 && (
            <section>
              <SectionHeader title="Tidigare prov" />
              <ul className="flex flex-col divide-y divide-border glass rounded-card">
                {past.map((p) => (
                  <li key={p.id}>
                    <Link href={`/exams/${p.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.07]">
                      <span className="font-semibold text-ink">{p.title}</span>
                      <span className="text-sm text-muted">{longDate(p.exam_date)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
