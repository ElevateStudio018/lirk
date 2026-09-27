"use client";

import { ArrowRight, CheckCircle2, ChevronDown, FileText, Scale, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SectionHeader } from "@/components/ui/section-header";
import { DIMENSION_LABELS, DIMENSIONS, type Level } from "@/lib/ai/dimension-labels";
import type { OverallAssessment, PerQuestionResult } from "@/lib/services/assessment";
import { cn } from "@/lib/utils";

const LEVEL: Record<Level, { label: string; className: string }> = {
  strong: { label: "Stark", className: "bg-good-soft text-good" },
  ok: { label: "Godtagbar", className: "bg-info-soft text-info" },
  weak: { label: "Svag", className: "bg-warn-soft text-warn" },
  missing: { label: "Saknas", className: "bg-bad-soft text-bad" },
  not_applicable: { label: "–", className: "bg-surface-muted text-subtle" },
};

type Props = {
  exam: { id: string; kind: "mock1" | "final"; title: string; project_id: string };
  totalScore: number;
  maxScore: number;
  criteriaAvailable: boolean;
  overall: OverallAssessment;
  perQuestion: PerQuestionResult[];
  targets: Array<{ id: string; title: string; description: string; status: string }>;
  materials: Record<string, string>;
  remediationSessionId: string | null;
};

export function ResultView({ exam, totalScore, maxScore, criteriaAvailable, overall, perQuestion, targets, materials, remediationSessionId }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const share = maxScore ? totalScore / maxScore : 0;
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ProgressRing value={share} size={112} stroke={10} label={<span className="text-2xl font-bold tabular-nums text-ink">{Math.round(share * 100)}%</span>} aria-label="Andel poäng" />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">{exam.kind === "mock1" ? "Övningsprov 1" : "Slutprov"} · analys</p>
          <h1 className="mt-1 text-title font-bold text-ink">
            {String(totalScore).replace(".", ",")} av {maxScore} poäng
          </h1>
          <Link href={`/exams/${exam.project_id}`} className="mt-1 inline-block text-sm font-semibold text-muted hover:text-ink">
            Till provet →
          </Link>
        </div>
      </header>

      <Card tone="muted" className="flex gap-4">
        <Scale className="mt-0.5 size-5 shrink-0 text-muted" />
        <div>
          <p className="font-semibold text-ink">{criteriaAvailable ? "Jämfört med betygskriterierna" : "Om betygskriterier"}</p>
          <p className="mt-1 text-text">{overall.criteria_statement}</p>
          <p className="mt-2 text-xs text-muted">Det här är en analys av dina svar just nu – inte ett betyg och ingen förutsägelse av provresultatet.</p>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="flex items-center gap-2 font-semibold text-good">
            <CheckCircle2 className="size-5" /> Det här gör du bra
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {overall.strengths.map((s, i) => (
              <li key={i} className="text-text">{s}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="flex items-center gap-2 font-semibold text-brand">
            <TrendingUp className="size-5" /> Det här håller dig tillbaka
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {overall.holding_back.map((s, i) => (
              <li key={i} className="text-text">{s}</li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="De tre viktigaste sakerna att fixa" />
        <ol className="flex flex-col gap-3">
          {overall.top_fixes.map((f, i) => (
            <li key={i} className="flex gap-4 rounded-card border border-border bg-surface p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold text-on-primary">{i + 1}</span>
              <div>
                <p className="font-semibold text-ink">{f.title}</p>
                <p className="mt-1 text-muted">{f.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {exam.kind === "mock1" && targets.length > 0 && (
        <Card tone="ink" className="flex flex-col gap-4">
          <p className="flex items-center gap-2 font-semibold">
            <Target className="size-5 text-brand" /> Din träning inför slutprovet
          </p>
          <ul className="flex flex-col gap-2">
            {targets.map((t) => (
              <li key={t.id} className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                <span>
                  <strong>{t.title}</strong> <span className="opacity-70">– {t.description}</span>
                </span>
              </li>
            ))}
          </ul>
          {remediationSessionId && (
            <Link href={`/study/${remediationSessionId}`} className={buttonVariants({ variant: "brand", size: "lg" })}>
              Träna på svagheterna <ArrowRight />
            </Link>
          )}
        </Card>
      )}
      {exam.kind === "final" && (
        <Link href={`/exams/${exam.project_id}/report`} className={buttonVariants({ variant: "brand", size: "lg" })}>
          Jämför med övningsprov 1 <ArrowRight />
        </Link>
      )}

      <section>
        <SectionHeader title="Fråga för fråga" />
        <ul className="flex flex-col gap-2">
          {perQuestion.map((p) => {
            const isOpen = open === p.question_id;
            return (
              <li key={p.question_id} className="rounded-card border border-border bg-surface">
                <button type="button" onClick={() => setOpen(isOpen ? null : p.question_id)} className="flex w-full items-center gap-4 p-4 text-left sm:p-5" aria-expanded={isOpen}>
                  <span className="w-8 shrink-0 text-sm font-bold text-muted">{p.position + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium text-ink">{p.prompt}</span>
                    <span className="text-xs text-muted">{p.topic_title}</span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums", p.earned >= p.points * 0.7 ? "bg-good-soft text-good" : p.earned > 0 ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad")}>
                    {String(p.earned).replace(".", ",")}/{p.points}
                  </span>
                  <ChevronDown className={cn("size-5 shrink-0 text-subtle transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-5 border-t border-border p-4 sm:p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ditt svar</p>
                      <p className="mt-1 whitespace-pre-wrap text-text">{p.answer_text || "(inget svar)"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Facit / riktlinje</p>
                      <p className="mt-1 text-text">{p.correct_answer}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {DIMENSIONS.map((d) => {
                        const v = p[d];
                        if (!v || v.level === "not_applicable") return null;
                        return (
                          <div key={d} className="rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-ink">{DIMENSION_LABELS[d]}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", LEVEL[v.level].className)}>{LEVEL[v.level].label}</span>
                            </div>
                            {v.comment && <p className="mt-1.5 text-xs text-muted">{v.comment}</p>}
                          </div>
                        );
                      })}
                    </div>
                    {p.feedback && <p className="text-text">{p.feedback}</p>}
                    {p.misconceptions.length > 0 && (
                      <Alert tone="warning" title="Missuppfattning">
                        {p.misconceptions.join(" · ")}
                      </Alert>
                    )}
                    {p.source_refs.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {p.source_refs.map((r, i) => (
                          <p key={i} className="flex items-start gap-2 text-xs text-muted">
                            <FileText className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                              <Badge tone="outline" className="mr-1">{materials[r.source_material_id] ?? "Material"}</Badge>
                              {r.why}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
