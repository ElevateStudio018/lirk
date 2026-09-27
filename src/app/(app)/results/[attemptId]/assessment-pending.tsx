"use client";

import { Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, postJSON } from "@/lib/api/client";

/** Runs the assessment (separately from submission) and shows honest progress. */
export function AssessmentPending({ attemptId, status, examId, error: initialError }: { attemptId: string; status: string; examId: string; error: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(status === "assessment_failed" ? (initialError ?? "Bedömningen misslyckades.") : null);
  const autoRun = status === "submitted" || status === "assessing";
  const [running, setRunning] = useState(autoRun);
  const triggered = useRef(false);

  const assess = () =>
    postJSON(`/api/attempts/${attemptId}/assess`)
      .then(() => router.refresh())
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setRunning(false));

  const run = () => {
    setRunning(true);
    setError(null);
    void assess();
  };

  useEffect(() => {
    if (triggered.current || !autoRun) return;
    triggered.current = true;
    void assess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  if (status === "in_progress") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <h1 className="text-title font-bold text-ink">Provet är inte inlämnat än</h1>
        <Link href={`/exam/${examId}`} className={buttonVariants({ size: "lg", className: "mt-6" })}>
          Fortsätt provet
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 py-6">
      <h1 className="text-title font-bold text-ink">Ditt prov är inlämnat och låst</h1>
      {error ? (
        <Alert
          tone="error"
          title="Bedömningen kunde inte göras"
          action={
            <Button size="sm" variant="secondary" onClick={run} loading={running}>
              {!running && <RotateCcw />} Försök igen
            </Button>
          }
        >
          {error} Dina svar är sparade.
        </Alert>
      ) : (
        <>
          <p className="flex items-center gap-2 text-muted">
            <Loader2 className="size-4 animate-spin" /> Varje svar analyseras mot ditt underlag{running ? "" : " "}– korrekthet, förståelse, metod, resonemang, begrepp och fullständighet. Det tar oftast 30–90 sekunder.
          </p>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </>
      )}
    </div>
  );
}
