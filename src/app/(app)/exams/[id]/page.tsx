import { Check } from "lucide-react";
import Link from "next/link";
import { NextStepCard } from "@/components/study/next-step-card";
import { ReadinessCard } from "@/components/study/readiness-card";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { getProjectOverview } from "@/lib/services/overview";
import { requireUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { DeleteProjectButton } from "./delete-project";

const ORDER = ["collecting", "analyzing", "map_ready", "diagnosed", "studying", "mock1_done", "final_done"];

export default async function ExamOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const o = await getProjectOverview(supabase, id);
  const at = ORDER.indexOf(o.project.status);
  const journey = [
    { label: "Underlag", done: o.materialCounts.ready > 0 && at >= 2, href: `/exams/${id}/materials` },
    { label: "Vad du ska kunna", done: at >= 2, href: `/exams/${id}/map` },
    { label: "Kolla vad du kan", done: at >= 3, href: `/exams/${id}/diagnostic` },
    { label: "Plan och pass", done: at >= 5, href: `/exams/${id}/plan` },
    { label: "Övningsprov", done: at >= 5, href: `/exams/${id}/report` },
    { label: "Slutprov", done: at >= 6, href: `/exams/${id}/report` },
  ];
  const current = journey.findIndex((j) => !j.done);

  return (
    <div className="flex flex-col gap-10">
      <NextStepCard step={o.next} />

      <section>
        <SectionHeader title="Din väg till provet" />
        <ol className="grid gap-2 sm:grid-cols-3">
          {journey.map((j, i) => (
            <li key={j.label}>
              <Link
                href={j.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-4 transition-colors",
                  i === current ? "border-ink bg-surface shadow-sm" : "border-border bg-surface hover:bg-surface-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                    j.done ? "bg-good text-white" : i === current ? "bg-primary text-on-primary" : "bg-surface-muted text-muted",
                  )}
                >
                  {j.done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={cn("font-semibold", j.done || i === current ? "text-ink" : "text-muted")}>{j.label}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {o.topics.length > 0 && (
        <section className="grid gap-6 md:grid-cols-2">
          <ReadinessCard readiness={o.readiness} />
          <Card tone="muted" className="flex flex-col justify-center">
            <p className="text-sm font-semibold text-muted">Pass</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
              {o.completedSessions} / {o.sessions.length || "–"}
            </p>
            <p className="mt-1 text-sm text-muted">{o.sessions.length ? "avklarade enligt planen" : "Planen skapas efter testet"}</p>
          </Card>
        </section>
      )}

      <section className="border-t border-border pt-8">
        <DeleteProjectButton projectId={id} title={o.project.title} />
      </section>
    </div>
  );
}
