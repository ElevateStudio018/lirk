"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FeedbackPanel, type Feedback } from "@/components/questions/feedback";
import { initialAnswer, isAnswerComplete, QuestionInput } from "@/components/questions/question-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, getJSON, postJSON } from "@/lib/api/client";
import type { Answer, PublicQuestion } from "@/lib/domain/questions";

type SetView = {
  id: string;
  purpose: string;
  topicTitle: string;
  questions: Array<{ question: PublicQuestion; result: (Feedback & { answer: Answer | null }) | null }>;
};

export function ExerciseStep({ setId, onDone, completing }: { setId: string; onDone: () => void; completing: boolean }) {
  const [set, setSet] = useState<SetView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [results, setResults] = useState<Record<string, Feedback>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      getJSON<SetView>(`/api/exercises/${setId}`)
      .then((s) => {
        setLoadError(null);
        setSet(s);
        const done: Record<string, Feedback> = {};
        for (const q of s.questions) if (q.result) done[q.question.id] = q.result;
        setResults(done);
        const first = s.questions.findIndex((q) => !q.result);
        const idx = first === -1 ? s.questions.length - 1 : first;
        setIndex(idx);
        setAnswer(first === -1 ? null : initialAnswer(s.questions[idx].question));
      })
      .catch((e) => setLoadError(errorMessage(e))),
    [setId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (loadError)
    return (
      <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={() => void load()}><RotateCcw /> Försök igen</Button>}>
        {loadError}
      </Alert>
    );
  if (!set) return <Skeleton className="h-60 w-full" />;

  const q = set.questions[index].question;
  const result = results[q.id];
  const last = index === set.questions.length - 1;

  const submit = async () => {
    if (!answer) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postJSON<Feedback>(`/api/exercises/${setId}/answer`, { questionId: q.id, answer });
      setResults((x) => ({ ...x, [q.id]: r }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    const i = index + 1;
    setIndex(i);
    setAnswer(initialAnswer(set.questions[i].question));
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-sm text-muted">
        <span className="font-semibold">{set.topicTitle}</span>
        <span className="tabular-nums">
          Fråga {index + 1} av {set.questions.length}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="flex flex-col gap-6">
          <h2 className="whitespace-pre-line text-xl font-semibold leading-snug text-ink">{q.prompt}</h2>
          <QuestionInput question={q} value={answer} onChange={setAnswer} disabled={busy || Boolean(result)} />
          {result && <FeedbackPanel result={result} />}
        </motion.div>
      </AnimatePresence>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="sticky bottom-4 z-10">
        {!result ? (
          <Button size="lg" block onClick={submit} disabled={!isAnswerComplete(q, answer)} loading={busy} className="shadow-lg">
            {busy ? "Rättar…" : "Svara"}
          </Button>
        ) : last ? (
          <Button size="lg" block onClick={onDone} loading={completing} className="shadow-lg">
            Klar <ArrowRight />
          </Button>
        ) : (
          <Button size="lg" block onClick={next} className="shadow-lg">
            Nästa fråga <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}
