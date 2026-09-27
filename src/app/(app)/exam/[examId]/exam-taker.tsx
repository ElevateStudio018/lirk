"use client";

import { ArrowLeft, ArrowRight, Clock, Lock, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { initialAnswer, isAnswerComplete, QuestionInput } from "@/components/questions/question-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { errorMessage, postJSON } from "@/lib/api/client";
import type { Answer, PublicQuestion } from "@/lib/domain/questions";
import { cn } from "@/lib/utils";

type Props = {
  exam: { id: string; projectId: string; title: string; kind: string; instructions: string; timeLimit: number; totalPoints: number };
  questions: Array<{ id: string; points: number; question: PublicQuestion }>;
  attempt: { id: string; startedAt: string; answers: Record<string, Answer> } | null;
};

function useCountdown(startedAt: string | null, minutes: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return null;
  return Math.round((new Date(startedAt).getTime() + minutes * 60_000 - now) / 1000);
}

export function ExamTaker({ exam, questions, attempt: initialAttempt }: Props) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(initialAttempt);
  const [answers, setAnswers] = useState<Record<string, Answer>>(initialAttempt?.answers ?? {});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const dirty = useRef<Record<string, Answer>>({});
  const remaining = useCountdown(attempt?.startedAt ?? null, exam.timeLimit);

  const flush = useCallback(async () => {
    if (!attempt || Object.keys(dirty.current).length === 0) return;
    const batch = dirty.current;
    dirty.current = {};
    setSaveState("saving");
    try {
      await postJSON(`/api/attempts/${attempt.id}/save`, { answers: batch });
      setSaveState("saved");
    } catch {
      dirty.current = { ...batch, ...dirty.current };
      setSaveState("error");
    }
  }, [attempt]);

  // Autosave shortly after each change, and when leaving the page.
  useEffect(() => {
    const t = setTimeout(() => void flush(), 1200);
    return () => clearTimeout(t);
  }, [answers, flush]);
  useEffect(() => {
    const onHide = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await postJSON<{ attemptId: string; status: string }>(`/api/mock-exams/${exam.id}/start`);
      if (r.status !== "in_progress") {
        router.push(`/results/${r.attemptId}`);
        return;
      }
      setAttempt({ id: r.attemptId, startedAt: new Date().toISOString(), answers: {} });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const setAnswer = (qid: string, a: Answer) => {
    setAnswers((x) => ({ ...x, [qid]: a }));
    dirty.current[qid] = a;
  };

  const submit = async () => {
    if (!attempt) return;
    setBusy(true);
    setError(null);
    try {
      const complete = Object.fromEntries(Object.entries(answers).filter(([id, a]) => isAnswerComplete(questions.find((q) => q.id === id)!.question, a)));
      await postJSON(`/api/attempts/${attempt.id}/submit`, { answers: complete });
      router.push(`/results/${attempt.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
      setConfirm(false);
    }
  };

  // ---- intro -----------------------------------------------------------------
  if (!attempt) {
    return (
      <div className="mx-auto max-w-xl py-4">
        <Link href={`/exams/${exam.projectId}`} className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Tillbaka
        </Link>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">{exam.kind === "mock1" ? "Övningsprov" : "Slutprov"}</p>
        <h1 className="mt-1 text-title font-bold text-ink">{exam.title}</h1>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: "Frågor", value: questions.length },
            { label: "Poäng", value: exam.totalPoints },
            { label: "Minuter", value: exam.timeLimit },
          ].map((s) => (
            <Card key={s.label} tone="muted" className="text-center">
              <p className="text-2xl font-bold tabular-nums text-ink">{s.value}</p>
              <p className="text-sm text-muted">{s.label}</p>
            </Card>
          ))}
        </div>
        {exam.instructions && <p className="mt-6 whitespace-pre-line text-text">{exam.instructions}</p>}
        <ul className="mt-6 flex flex-col gap-2 text-muted">
          <li className="flex gap-2"><Lock className="mt-1 size-4 shrink-0" /> Ingen hjälp och ingen feedback under provet – precis som på riktigt.</li>
          <li className="flex gap-2"><Clock className="mt-1 size-4 shrink-0" /> Tiden är en riktlinje. Dina svar sparas automatiskt.</li>
        </ul>
        {error && <Alert tone="error" className="mt-6">{error}</Alert>}
        <Button size="lg" variant="brand" block className="mt-8" onClick={start} loading={busy}>
          Starta provet
        </Button>
      </div>
    );
  }

  // ---- taking the exam -----------------------------------------------------------
  const q = questions[index];
  const answered = questions.filter((x) => isAnswerComplete(x.question, answers[x.id] ?? null)).length;
  const unanswered = questions.length - answered;
  const timeText =
    remaining === null ? "" : remaining <= 0 ? "Tiden är ute" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="sticky top-0 z-20 -mx-5 mb-6 border-b border-border bg-background/95 px-5 pb-3 pt-safe backdrop-blur sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
        <div className="flex items-center gap-3 pt-3">
          <Link href={`/exams/${exam.projectId}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-muted" aria-label="Pausa och gå ut (svaren sparas)">
            <X className="size-5" />
          </Link>
          <p className="min-w-0 flex-1 truncate font-semibold text-ink">{exam.title}</p>
          <span className={cn("text-xs", saveState === "error" ? "text-bad" : "text-subtle")}>
            {saveState === "saving" ? "Sparar…" : saveState === "error" ? "Ej sparat" : "Sparat"}
          </span>
          <span className={cn("rounded-full px-3 py-1 text-sm font-bold tabular-nums", remaining !== null && remaining <= 60 ? "bg-bad-soft text-bad" : "bg-surface-muted text-ink")}>
            {timeText}
          </span>
        </div>
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {questions.map((x, i) => {
            const done = isAnswerComplete(x.question, answers[x.id] ?? null);
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Fråga ${i + 1}${done ? ", besvarad" : ""}`}
                aria-current={i === index}
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-md text-sm font-bold",
                  i === index ? "bg-primary text-on-primary" : done ? "bg-surface-sunken text-ink" : "border border-border text-muted",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-muted">Fråga {index + 1}</p>
          <p className="text-sm font-semibold text-muted">{q.points} p</p>
        </div>
        <h2 className="whitespace-pre-line text-xl font-semibold leading-snug text-ink">{q.question.prompt}</h2>
        <QuestionInput question={q.question} value={answers[q.id] ?? initialAnswer(q.question)} onChange={(a) => setAnswer(q.id, a)} />
      </div>

      {error && <Alert tone="error" className="mt-6">{error}</Alert>}
      {remaining !== null && remaining <= 0 && (
        <Alert tone="warning" className="mt-6">
          Tiden är ute. Lämna in när du är klar med frågan du håller på med.
        </Alert>
      )}

      <div className="sticky bottom-4 z-10 mt-10 flex gap-2">
        <Button variant="secondary" size="lg" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="Föregående fråga">
          <ArrowLeft />
        </Button>
        {index < questions.length - 1 ? (
          <Button size="lg" className="flex-1" onClick={() => setIndex(index + 1)}>
            Nästa <ArrowRight />
          </Button>
        ) : (
          <Button size="lg" variant="brand" className="flex-1" onClick={() => setConfirm(true)}>
            Lämna in
          </Button>
        )}
      </div>
      {index < questions.length - 1 && (
        <button type="button" onClick={() => setConfirm(true)} className="mt-4 w-full text-center text-sm font-semibold text-muted hover:text-ink">
          Lämna in provet
        </button>
      )}

      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Lämna in provet?"
        description={unanswered > 0 ? `Du har ${unanswered} obesvarade ${unanswered === 1 ? "fråga" : "frågor"}. Efter inlämning går det inte att ändra.` : "Efter inlämning låses provet och går inte att ändra."}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Fortsätt skriva
          </Button>
          <Button variant="brand" onClick={submit} loading={busy}>
            Lämna in
          </Button>
        </div>
      </Modal>
    </div>
  );
}
