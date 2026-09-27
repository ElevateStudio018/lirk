"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Minus, MessageCircleQuestion, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { errorMessage, postJSON } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Q = { id: string; question: string; why: string; options: string[]; allowFreeText: boolean; answered: boolean; answer: string | null };
type Change = { kind: "importance" | "removed" | "added"; title: string; detail: string };

export function ClarifyRunner({ projectId, questions, done }: { projectId: string; questions: Q[]; done: boolean }) {
  const router = useRouter();
  const [answered, setAnswered] = useState(() => new Set(questions.filter((q) => q.answered).map((q) => q.id)));
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary: string | null; changes: Change[] } | null>(null);

  const remaining = questions.filter((q) => !answered.has(q.id));
  const current = remaining[0] ?? null;

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
      await postJSON(`/api/projects/${projectId}/clarify`);
      router.refresh();
    });

  const finish = () =>
    call(async () => {
      setResult(await postJSON(`/api/projects/${projectId}/clarify/complete`));
      router.refresh();
    });

  const submit = (answer: string | null) =>
    call(async () => {
      if (!current) return;
      await postJSON(`/api/projects/${projectId}/clarify/answer`, { questionId: current.id, answer });
      const next = new Set(answered).add(current.id);
      setAnswered(next);
      setChoice(null);
      setText("");
      if (questions.every((q) => next.has(q.id))) setResult(await postJSON(`/api/projects/${projectId}/clarify/complete`));
    });

  const composed = [choice, text.trim()].filter(Boolean).join(". ");

  // ---- done: show what changed ------------------------------------------------------
  if (result || done) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-xl flex-col gap-6">
        <span className="grid size-14 place-items-center rounded-full bg-white text-black">
          <Check className="size-7" />
        </span>
        <h2 className="text-title font-bold text-ink">Tack! Kartan är uppdaterad.</h2>
        {result?.summary && <p className="text-lg text-muted">{result.summary}</p>}
        {result && result.changes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {result.changes.map((c, i) => (
              <li key={i} className="glass flex gap-3 rounded-lg p-4">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-ink">
                  {c.kind === "added" ? <Plus className="size-4" /> : c.kind === "removed" ? <Minus className="size-4" /> : <Sparkles className="size-4" />}
                </span>
                <div>
                  <p className="font-semibold text-ink">
                    {c.kind === "added" ? "Nytt: " : c.kind === "removed" ? "Borttaget: " : ""}
                    {c.title}
                  </p>
                  <p className="text-sm text-muted">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {result && result.changes.length === 0 && <p className="text-muted">Dina svar stämde med kartan, så inget behövde ändras.</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/exams/${projectId}/diagnostic`} className={cn(buttonVariants({ size: "lg", variant: "brand" }), "flex-1")}>
            Kolla vad du redan kan <ArrowRight />
          </Link>
          <Link href={`/exams/${projectId}/map`} className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "flex-1")}>
            Se kartan
          </Link>
        </div>
      </motion.div>
    );
  }

  // ---- intro -------------------------------------------------------------------------
  if (questions.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <span className="grid size-14 place-items-center rounded-full bg-white/10 text-ink">
          <MessageCircleQuestion className="size-7" />
        </span>
        <h2 className="text-title font-bold text-ink">Några snabba frågor</h2>
        <p className="text-lg text-muted">
          Vi har läst ditt underlag. Nu vill vi fråga om det som är oklart – till exempel vilka kapitel som ingår eller vad läraren har tjatat om. Då blir din plan
          mer träffsäker. Det tar ungefär två minuter.
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        <Button size="lg" block onClick={start} loading={busy}>
          {busy ? "AI:n tänker ut frågor…" : "Starta"}
        </Button>
        <button type="button" onClick={finish} disabled={busy} className="text-sm font-semibold text-muted hover:text-ink">
          Hoppa över
        </button>
      </div>
    );
  }

  // ---- all answered but not completed (e.g. reload) -----------------------------------
  if (!current) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <h2 className="text-title font-bold text-ink">Alla frågor är besvarade</h2>
        {error && <Alert tone="error">{error}</Alert>}
        <Button size="lg" onClick={finish} loading={busy}>
          Uppdatera kartan
        </Button>
      </div>
    );
  }

  // ---- one question at a time ----------------------------------------------------------
  const index = questions.length - remaining.length;
  const last = remaining.length === 1;
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex items-center gap-4">
        <ProgressBar value={index / questions.length} size="sm" aria-label="Framsteg" />
        <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
          {index + 1}/{questions.length}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={current.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-bold leading-snug text-ink">{current.question}</h2>
            <p className="mt-2 text-sm text-muted">{current.why}</p>
          </div>
          <div className="grid gap-2" role="radiogroup">
            {current.options.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={choice === o}
                disabled={busy}
                onClick={() => setChoice(choice === o ? null : o)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-4 py-3.5 text-left text-[15px] font-medium text-ink transition-all",
                  choice === o ? "border-white/50 bg-white/[0.14]" : "border-white/10 bg-white/[0.05] hover:bg-white/[0.09]",
                )}
              >
                {o}
                {choice === o && <Check className="size-4 shrink-0" />}
              </button>
            ))}
          </div>
          {current.allowFreeText && (
            <Textarea value={text} onChange={(e) => setText(e.target.value)} disabled={busy} placeholder="Eller skriv med egna ord (valfritt)" className="min-h-20" aria-label="Eget svar" />
          )}
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
        <Button size="lg" className="flex-1" onClick={() => submit(composed)} disabled={!composed} loading={busy}>
          {busy && last ? "Uppdaterar kartan…" : last ? "Klar" : "Nästa"} {!busy && <ArrowRight />}
        </Button>
      </div>
      {busy && last && <p className="mt-3 text-center text-sm text-muted">AI:n justerar kartan efter dina svar. Det tar några sekunder.</p>}
    </div>
  );
}
