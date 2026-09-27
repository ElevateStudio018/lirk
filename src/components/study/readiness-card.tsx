"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { readinessLabel, type Readiness } from "@/lib/engine/readiness";
import { cn } from "@/lib/utils";

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function ReadinessCard({ readiness, className }: { readiness: Readiness; className?: string }) {
  const [open, setOpen] = useState(false);
  const label = readinessLabel(readiness.score, readiness.coverage);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("flex w-full items-center gap-5 glass rounded-card p-5 text-left transition-colors hover:bg-white/[0.08] sm:p-6", className)}
      >
        <ProgressRing
          value={readiness.score}
          size={76}
          stroke={8}
          label={<span className="text-lg font-bold tabular-nums text-ink">{Math.round(readiness.score * 100)}</span>}
          aria-label="Provberedskap"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted">Provberedskap</p>
          <p className="text-lg font-semibold text-ink">{label}</p>
          <p className="mt-0.5 text-sm text-muted">Mätt på {pct(readiness.coverage)} av provets innehåll</p>
        </div>
        <ChevronRight className="size-5 text-subtle" aria-hidden />
      </button>

      <Modal open={open} onOpenChange={setOpen} title="Så här räknades detta ut" description="Provberedskapen är ingen gissning om ditt betyg. Den visar hur mycket av provets innehåll du har visat att du kan – just nu.">
        <div className="flex flex-col gap-5 text-sm">
          <div className="rounded-lg bg-white/[0.06] p-4 font-mono text-[13px] leading-relaxed text-ink">
            områdespoäng = kunskap × (0,6 + 0,4 × säkerhet) × minne
            <br />
            provberedskap = viktat snitt av områdespoängen
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <dt className="text-muted">Provberedskap</dt>
              <dd className="text-xl font-bold text-ink">{pct(readiness.score)}</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-muted">Täckning</dt>
              <dd className="text-xl font-bold text-ink">{pct(readiness.coverage)}</dd>
            </div>
          </dl>
          <ul className="flex flex-col gap-2 text-muted">
            <li>
              <strong className="text-ink">Viktighet:</strong> områden som är viktigare för provet väger tyngre.
            </li>
            <li>
              <strong className="text-ink">Kunskap:</strong> uppskattas från alla dina svar – aldrig från ett enskilt svar.
            </li>
            <li>
              <strong className="text-ink">Säkerhet:</strong> hur mycket underlag vi har. Lite data drar ner poängen tills du har visat mer.
            </li>
            <li>
              <strong className="text-ink">Minne:</strong> det du inte har tränat på ett tag räknas lite lägre. Repetition höjer det igen.
            </li>
            <li>
              <strong className="text-ink">Täckning:</strong> hur stor del av provets innehåll vi faktiskt har mätt.
            </li>
          </ul>
          <div>
            <p className="mb-2 font-semibold text-ink">Per område</p>
            <ul className="flex flex-col gap-3">
              {readiness.topics.map((t) => (
                <li key={t.topic_id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-ink">{t.title}</span>
                    <span className="shrink-0 tabular-nums text-muted">{t.measured ? pct(t.topic_score) : "för lite data"}</span>
                  </div>
                  <ProgressBar value={t.topic_score} size="sm" className="mt-1.5" indicatorClassName={t.measured ? undefined : "bg-unknown"} />
                  <p className="mt-1 text-xs text-subtle">
                    viktighet {t.importance}/5 · kunskap {pct(t.mastery)} · säkerhet {pct(t.confidence)} · minne {pct(t.retention)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}
