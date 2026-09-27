"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarCheck, Check, ClipboardList, Loader2, Play, RotateCcw, Sparkles, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, postJSON } from "@/lib/api/client";
import { friendlyDate } from "@/lib/engine/dates";
import { ITEM_LABELS, type SessionItem } from "@/lib/domain/session";
import { cn } from "@/lib/utils";
import { ExerciseStep } from "./exercise-step";
import { LessonStep } from "./lesson-step";

type Decision = { action: string; reason: string } | null;

type Props = {
  session: { id: string; title: string; goal: string; kind: string; status: string; estimated_minutes: number; items: SessionItem[] };
  project: { id: string; title: string };
  nextSession: { id: string; title: string; scheduled_date: string } | null;
};

const LESSON_KINDS = new Set(["lesson", "micro_lesson", "example"]);
const EXERCISE_KINDS = new Set(["practice", "review", "harder", "easier", "confirmation"]);

const PREPARING_TEXT: Record<string, string> = {
  lesson: "Vi gör din lektion – med bilder, exempel och frågor mitt i. Det tar ungefär en halv minut.",
  micro_lesson: "Vi gör en kort mikrolektion om just det som var klurigt.",
  example: "Vi tar fram lösta exempel steg för steg.",
  practice: "Vi skapar övningar utifrån det du precis gått igenom.",
  review: "Vi plockar fram repetitionsfrågor.",
  harder: "Vi gör en svårare uppgift åt dig.",
  easier: "Vi tar fram enklare steg att bygga vidare på.",
  confirmation: "Vi gör en kontrollfråga.",
  mock_exam: "Vi konstruerar ett övningsprov utifrån ditt underlag. Det tar upp till en minut.",
  final_exam: "Vi konstruerar slutprovet med helt nya frågor. Det tar upp till en minut.",
};

export function SessionRunner({ session, project, nextSession }: Props) {
  const router = useRouter();
  const items = session.items;
  const current = items.find((i) => i.status === "pending") ?? null;
  const doneCount = items.filter((i) => i.status !== "pending").length;
  const [started, setStarted] = useState(session.status !== "pending");
  const [prepared, setPrepared] = useState<SessionItem | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [completing, setCompleting] = useState(false);

  // An item is ready when its content exists (ref_id). Content is generated lazily.
  const readyItem = current?.ref_id ? current : prepared && current && prepared.id === current.id && prepared.ref_id ? prepared : null;
  const preparing = started && Boolean(current) && !readyItem && !error;

  const runPrepare = () =>
    postJSON<{ item: SessionItem | null; decision: Decision }>(`/api/sessions/${session.id}/prepare`)
      .then((res) => {
        if (res.decision && res.decision.action !== "CONTINUE") setDecision(res.decision);
        setPrepared(res.item);
        router.refresh();
      })
      .catch((e) => setError({ message: errorMessage(e), retryable: (e as { retryable?: boolean }).retryable ?? true }));

  const retry = () => {
    setError(null);
    void runPrepare();
  };

  // Generate content for the current item when it becomes current.
  useEffect(() => {
    if (!started || !current || current.ref_id) return;
    void runPrepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, current?.id, current?.ref_id]);

  const complete = async () => {
    if (!current) return;
    setCompleting(true);
    setError(null);
    try {
      const res = await postJSON<{ decision: Decision; sessionCompleted: boolean }>(`/api/sessions/${session.id}/complete`, { itemId: current.id });
      if (res.decision && res.decision.action !== "CONTINUE") setDecision(res.decision);
      setPrepared(null);
      router.refresh();
    } catch (e) {
      setError({ message: errorMessage(e), retryable: true });
    } finally {
      setCompleting(false);
    }
  };

  const header = (
    <div className="sticky top-0 z-20 -mx-5 mb-6 border-b border-border bg-background/95 px-5 pb-3 pt-safe backdrop-blur sm:-mx-8 sm:px-8 lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
      <div className="flex items-center gap-3 pt-3">
        <Link href="/dashboard" className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-ink" aria-label="Stäng passet">
          <X className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{project.title}</p>
          <p className="truncate font-semibold text-ink">{session.title}</p>
        </div>
      </div>
      <ProgressBar value={items.length ? doneCount / items.length : 0} size="sm" className="mt-3" aria-label="Passets framsteg" />
    </div>
  );

  // ---- intro -------------------------------------------------------------------------
  if (!started && current) {
    return (
      <div className="mx-auto max-w-xl">
        {header}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">{session.estimated_minutes} min</p>
            <h1 className="mt-1 text-title font-bold text-ink">{session.title}</h1>
            <p className="mt-2 text-lg text-muted">{session.goal}</p>
          </div>
          <ol className="flex flex-col gap-2">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-muted text-xs font-bold text-muted">{i + 1}</span>
                <span className="flex-1 font-medium text-ink">{it.label}</span>
                <span className="text-sm tabular-nums text-muted">{it.minutes} min</span>
              </li>
            ))}
          </ol>
          <Button size="lg" variant="brand" block onClick={() => setStarted(true)}>
            <Play /> Starta
          </Button>
        </motion.div>
      </div>
    );
  }

  // ---- done ------------------------------------------------------------------------
  if (!current) {
    return (
      <div className="mx-auto max-w-xl">
        {header}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-good text-white">
            <Check className="size-8" />
          </span>
          <h1 className="text-title font-bold text-ink">Passet är klart</h1>
          <p className="max-w-sm text-muted">
            Du gick igenom {items.filter((i) => i.status === "done").length} aktiviteter. Planen har uppdaterats efter hur det gick.
          </p>
          {nextSession && (
            <Card tone="muted" className="w-full text-left">
              <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                <CalendarCheck className="size-4" /> Nästa pass · {friendlyDate(nextSession.scheduled_date)}
              </p>
              <p className="mt-1 font-semibold text-ink">{nextSession.title}</p>
            </Card>
          )}
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "flex-1")}>
              Till idag
            </Link>
            <Link href={`/exams/${project.id}/plan`} className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "flex-1")}>
              Visa planen
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const ready = readyItem;

  return (
    <div className={cn("mx-auto", LESSON_KINDS.has(current.kind) ? "max-w-3xl" : "max-w-xl")}>
      {header}

      <AnimatePresence>
        {decision && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
            <div className="flex gap-3 rounded-lg bg-info-soft p-4">
              <Wand2 className="mt-0.5 size-5 shrink-0 text-info" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-info">Därför gör vi det här</p>
                <p className="mt-0.5 text-sm text-text">{decision.reason}</p>
              </div>
              <button type="button" onClick={() => setDecision(null)} className="self-start text-muted hover:text-ink" aria-label="Stäng">
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">{ITEM_LABELS[current.kind]}</p>

      {error && (
        <Alert
          tone="error"
          title="Det gick inte att ladda"
          className="mb-6"
          action={
            error.retryable && (
              <Button size="sm" variant="secondary" onClick={retry}>
                <RotateCcw /> Försök igen
              </Button>
            )
          }
        >
          {error.message}
        </Alert>
      )}

      {!ready && !error && (
        <div className="flex flex-col gap-4" aria-busy>
          <p className="flex items-center gap-2 text-muted">
            <Loader2 className="size-4 animate-spin" /> {preparing ? PREPARING_TEXT[current.kind] : "Laddar…"}
          </p>
          <Skeleton className={cn("w-full", LESSON_KINDS.has(current.kind) ? "aspect-video" : "h-40")} />
          <Skeleton className="h-12 w-2/3" />
        </div>
      )}

      {ready && LESSON_KINDS.has(current.kind) && <LessonStep key={current.id} lessonId={ready.ref_id!} onDone={complete} completing={completing} />}
      {ready && EXERCISE_KINDS.has(current.kind) && <ExerciseStep key={current.id} setId={ready.ref_id!} onDone={complete} completing={completing} />}
      {ready && (current.kind === "mock_exam" || current.kind === "final_exam") && (
        <Card className="flex flex-col gap-4">
          <span className="grid size-12 place-items-center rounded-lg bg-brand-soft text-brand">
            <ClipboardList className="size-6" />
          </span>
          <h2 className="text-heading font-bold text-ink">{current.kind === "mock_exam" ? "Övningsprov" : "Slutprov"}</h2>
          <ul className="flex flex-col gap-1.5 text-muted">
            <li>• Ingen hjälp, inga ledtrådar och ingen feedback under provet.</li>
            <li>• Frågorna är nya och liknar hur ämnet brukar prövas.</li>
            <li>• När du lämnar in låses provet och analyseras sedan noggrant.</li>
          </ul>
          <Link href={`/exam/${ready.ref_id}`} className={buttonVariants({ size: "lg", variant: "brand" })}>
            <Sparkles /> Gå till provet <ArrowRight />
          </Link>
        </Card>
      )}
    </div>
  );
}
