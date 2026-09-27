"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, CircleHelp, ClipboardCheck, Sparkles, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { initialAnswer, isAnswerComplete, QuestionInput } from "@/components/questions/question-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { errorMessage, postJSON } from "@/lib/api/client";
import type { Answer, PublicQuestion } from "@/lib/domain/questions";

type Summary = { strong: string[]; needsHelp: string[]; unsure: string[] };
type Q = { id: string; answered: boolean; question: PublicQuestion };

export function DiagnosticRunner({
  projectId,
  questions,
  topicCount,
  initialSummary,
  hasPlan,
}: {
  projectId: string;
  questions: Q[];
  topicCount: number;
  initialSummary: Summary | null;
  hasPlan: boolean;
}) {
  const router = useRouter();
  const [answeredIds, setAnsweredIds] = useState(() => new Set(questions.filter((q) => q.answered).map((q) => q.id)));
  const remaining = questions.filter((q) => !answeredIds.has(q.id));
  const current = remaining[0] ?? null;
  const [answer, setAnswer] = useState<Answer | null>(current ? initialAnswer(current.question) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(initialSummary);

  const call = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    call(async () => {
      await postJSON(`/api/projects/${projectId}/diagnostic`);
      router.refresh();
    });

  const submit = (a: Answer | null) =>
    call(async () => {
      if (!current) return;
      await postJSON(`/api/projects/${projectId}/diagnostic/answer`, { questionId: current.id, answer: a });
      const next = new Set(answeredIds).add(current.id);
      setAnsweredIds(next);
      const upcoming = questions.find((q) => !next.has(q.id));
      setAnswer(upcoming ? initialAnswer(upcoming.question) : null);
      if (!upcoming) setSummary(await postJSON<Summary>(`/api/projects/${projectId}/diagnostic/complete`));
    });

  const buildPlan = () =>
    call(async () => {
      if (!hasPlan) await postJSON(`/api/projects/${projectId}/plan`);
      router.push(`/exams/${projectId}/plan`);
      router.refresh();
    });

  // ---- summary -----------------------------------------------------------------
  if (summary) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-xl flex-col gap-6">
        <h2 className="text-title font-bold text-ink">Tack! Nu vet vi var du står.</h2>
        {summary.strong.length > 0 && (
          <Card>
            <p className="flex items-center gap-2 font-semibold text-good">
              <CheckCircle2 className="size-5" /> Bra koll på
            </p>
            <p className="mt-2 text-lg text-ink">{summary.strong.join(", ")}</p>
          </Card>
        )}
        {summary.needsHelp.length > 0 && (
          <Card>
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Target className="size-5" /> Behöver mest hjälp med
            </p>
            <p className="mt-2 text-lg text-ink">{summary.needsHelp.join(", ")}</p>
          </Card>
        )}
        {summary.unsure.length > 0 && (
          <p className="flex items-start gap-2 text-sm text-muted">
            <CircleHelp className="mt-0.5 size-4 shrink-0" /> För lite underlag än för att säga något om: {summary.unsure.join(", ")}. Det tar vi reda på under passen.
          </p>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <Button size="lg" variant="brand" block onClick={buildPlan} loading={busy}>
          {!busy && <Sparkles />} {hasPlan ? "Visa din plan" : "Vi bygger din plan"}
        </Button>
      </motion.div>
    );
  }

  // ---- intro -----------------------------------------------------------------
  if (questions.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="grid size-14 place-items-center rounded-lg bg-white/10 text-ink">
          <ClipboardCheck className="size-7" />
        </div>
        <h2 className="text-title font-bold text-ink">Kolla vad du redan kan</h2>
        <p className="text-lg text-muted">
          Ett kort test med {Math.min(15, Math.max(8, topicCount + 2))}–15 frågor. Det ger <strong className="text-ink">inget betyg</strong> – det hjälper oss att
          lägga tiden på det du behöver. Svara ärligt, och tryck på ”Vet inte” hellre än att gissa.
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        <Button size="lg" block onClick={start} loading={busy}>
          {busy ? "Skapar frågorna…" : "Starta testet"}
        </Button>
        {busy && <p className="text-center text-sm text-muted">Frågorna skapas utifrån ditt underlag. Det tar ungefär en halv minut.</p>}
      </div>
    );
  }

  // ---- all answered but summary not fetched (e.g. reload) -------------------------
  if (!current) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <h2 className="text-title font-bold text-ink">Alla frågor är besvarade</h2>
        {error && <Alert tone="error">{error}</Alert>}
        <Button size="lg" onClick={() => call(async () => setSummary(await postJSON<Summary>(`/api/projects/${projectId}/diagnostic/complete`)))} loading={busy}>
          Visa resultatet
        </Button>
      </div>
    );
  }

  // ---- question -------------------------------------------------------------------
  const index = questions.length - remaining.length;
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex items-center gap-4">
        <ProgressBar value={index / questions.length} size="sm" aria-label="Framsteg" />
        <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
          {index + 1}/{questions.length}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={current.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          <h2 className="mb-6 text-xl font-semibold leading-snug text-ink sm:text-2xl">{current.question.prompt}</h2>
          <QuestionInput question={current.question} value={answer} onChange={setAnswer} disabled={busy} />
        </motion.div>
      </AnimatePresence>
      {error && (
        <Alert tone="error" className="mt-6">
          {error}
        </Alert>
      )}
      <div className="mt-8 flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => submit(null)} disabled={busy}>
          Vet inte
        </Button>
        <Button size="lg" className="flex-1" onClick={() => submit(answer)} disabled={!isAnswerComplete(current.question, answer)} loading={busy}>
          Nästa <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
