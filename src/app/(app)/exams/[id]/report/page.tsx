import { ArrowRight, ClipboardList, Eye, HelpCircle, TrendingUp } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { DIMENSION_LABELS, type Dimension } from "@/lib/ai/dimension-labels";
import { getAssessmentsByKind, getFinalReport } from "@/lib/services/report";
import { requireUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [byKind, report, { data: mockSession }] = await Promise.all([
    getAssessmentsByKind(supabase, id),
    getFinalReport(supabase, id),
    supabase.from("study_sessions").select("id, status, kind").eq("project_id", id).in("kind", ["mock1", "remediation_final"]).order("position"),
  ]);
  const mock1 = byKind.mock1;
  const final = byKind.final;

  if (!mock1?.attemptId) {
    const s = mockSession?.find((x) => x.kind === "mock1");
    return (
      <EmptyState
        icon={ClipboardList}
        title="Inga provresultat än"
        description="Övningsprovet ligger i slutet av din plan. Där får du en djup analys av dina svar."
        action={
          s ? (
            <Link href={`/study/${s.id}`} className={buttonVariants()}>
              Gör övningsprovet nu
            </Link>
          ) : (
            <Link href={`/exams/${id}/plan`} className={buttonVariants({ variant: "secondary" })}>
              Visa planen
            </Link>
          )
        }
      />
    );
  }

  const card = (label: string, entry: typeof byKind.final) => (
    <Card>
      <p className="text-sm font-semibold text-muted">{label}</p>
      {entry?.result ? (
        <>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
            {String(entry.result.total_score).replace(".", ",")} / {entry.result.max_score} p
          </p>
          <Link href={`/results/${entry.attemptId}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ink">
            Se analysen <ArrowRight className="size-4" />
          </Link>
        </>
      ) : entry?.attemptId ? (
        <Link href={`/results/${entry.attemptId}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink">
          {entry.status === "in_progress" ? "Fortsätt provet" : "Visa bedömningen"} <ArrowRight className="size-4" />
        </Link>
      ) : (
        <p className="mt-2 text-sm text-muted">Öppnas efter träningen på svagheterna.</p>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-4 sm:grid-cols-2">
        {card("Övningsprov 1", mock1)}
        {card("Slutprov", final)}
      </div>

      {report ? (
        <>
          <Card tone="ink" className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Mock 1 → Slutprov</p>
            <p className="text-3xl font-bold tabular-nums">
              {pct(report.totalBefore)} → {pct(report.totalAfter)}
            </p>
            <p className="opacity-70">
              {report.totalAfter > report.totalBefore
                ? "Du fick en större andel av poängen på slutprovet."
                : report.totalAfter === report.totalBefore
                  ? "Samma andel av poängen på båda proven."
                  : "Slutprovet gick sämre räknat i poäng – titta på vad som var osäkert nedan."}
            </p>
          </Card>

          <section>
            <SectionHeader title="Vad förbättrades?" />
            {report.improved.length ? (
              <ul className="flex flex-col gap-2">
                {report.improved.map((t) => (
                  <li key={t.topic_id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.05] p-4">
                    <TrendingUp className="size-5 shrink-0 text-good" />
                    <span className="flex-1 font-semibold text-ink">{t.title}</span>
                    <span className="tabular-nums text-muted">
                      {pct(t.before)} → <strong className="text-good">{pct(t.after)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Inga områden förbättrades tydligt (minst 10 procentenheter) mellan proven.</p>
            )}
            {report.dimensionChanges.some((d) => d.before !== null && d.after !== null) && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {report.dimensionChanges
                  .filter((d) => d.before !== null && d.after !== null)
                  .map((d) => {
                    const up = (d.after ?? 0) - (d.before ?? 0);
                    return (
                      <div key={d.dimension} className="rounded-lg bg-white/[0.06] p-3">
                        <p className="text-sm font-semibold text-ink">{DIMENSION_LABELS[d.dimension as Dimension] ?? d.dimension}</p>
                        <p className={cn("text-sm font-bold tabular-nums", up > 0.05 ? "text-good" : up < -0.05 ? "text-bad" : "text-muted")}>
                          {up > 0.05 ? "Bättre" : up < -0.05 ? "Sämre" : "Oförändrat"}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="Vad är fortfarande osäkert?" />
            {report.uncertain.length ? (
              <ul className="flex flex-col gap-2">
                {report.uncertain.map((t) => (
                  <li key={t.topic_id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.05] p-4">
                    <HelpCircle className="size-5 shrink-0 text-warn" />
                    <span className="flex-1 font-semibold text-ink">{t.title}</span>
                    <span className="tabular-nums text-muted">{pct(t.after)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Inga områden ser osäkra ut just nu.</p>
            )}
          </section>

          <section>
            <SectionHeader title="Titta på det här precis innan provet" />
            <Card>
              <ul className="flex flex-col gap-3">
                {report.lastMinute.map((l, i) => (
                  <li key={i} className="flex gap-3 text-text">
                    <Eye className="mt-0.5 size-5 shrink-0 text-ink" /> {l}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </>
      ) : (
        mock1.result && (
          <p className="text-muted">När du har gjort slutprovet jämför vi det med övningsprov 1 här.</p>
        )
      )}
    </div>
  );
}
