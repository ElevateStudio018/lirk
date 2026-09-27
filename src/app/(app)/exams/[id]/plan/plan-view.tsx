"use client";

import { Check, ChevronDown, ClipboardList, Flag, RefreshCw, Repeat, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { errorMessage, postJSON } from "@/lib/api/client";
import { friendlyDate, todayISO } from "@/lib/engine/dates";
import { cn } from "@/lib/utils";

type Session = { id: string; title: string; goal: string; kind: string; status: string; scheduled_date: string; estimated_minutes: number };
type Priority = { topic_id: string; title: string; priority: number; importance: number; gap: number; certainty: number; prerequisite_weight: number; decision: string };
type Decision = { id: string; action: string; reason: string; created_at: string; topic: string | null };

const ACTION_LABEL: Record<string, string> = {
  SKIP: "Hoppade över",
  CONTINUE: "Fortsatte",
  REVIEW: "Lade in repetition",
  MICRO_LESSON: "Mikrolektion",
  EASIER_EXAMPLE: "Enklare exempel",
  HARDER_QUESTION: "Svårare fråga",
};

const KIND_ICON = { learn: Sparkles, review: Repeat, mock1: ClipboardList, remediation_final: Trophy } as const;

export function BuildButton({ projectId, label = "Bygg min plan" }: { projectId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        variant="brand"
        size="lg"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await postJSON(`/api/projects/${projectId}/plan`);
            router.refresh();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {!busy && <Sparkles />} {label}
      </Button>
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}

export function PlanView({
  projectId,
  sessions,
  notes,
  priorities,
  decisions,
  version,
}: {
  projectId: string;
  sessions: Session[];
  notes: string[];
  priorities: Priority[];
  decisions: Decision[];
  version: number;
}) {
  const router = useRouter();
  const [showWhy, setShowWhy] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();
  const nextId = (sessions.find((s) => s.status === "in_progress") ?? sessions.find((s) => s.status === "pending"))?.id;

  const replan = async () => {
    setReplanning(true);
    setError(null);
    try {
      await postJSON(`/api/projects/${projectId}/plan`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setReplanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionHeader
          title="Din plan"
          description={version > 1 ? `Planen har anpassats ${version - 1} ${version === 2 ? "gång" : "gånger"} efter hur det har gått.` : "Planen anpassas efter hur det går för dig."}
          action={
            <Button variant="ghost" size="sm" onClick={replan} loading={replanning}>
              {!replanning && <RefreshCw />} Uppdatera
            </Button>
          }
        />
        {error && (
          <Alert tone="error" className="mb-4">
            {error}
          </Alert>
        )}
        {notes.map((n, i) => (
          <Alert key={i} tone="info" className="mb-4">
            {n}
          </Alert>
        ))}
        <ol className="flex flex-col gap-2">
          {sessions.map((s) => {
            const Icon = KIND_ICON[s.kind as keyof typeof KIND_ICON] ?? Sparkles;
            const isNext = s.id === nextId;
            const done = s.status === "completed";
            const overdue = !done && s.scheduled_date < today;
            return (
              <li key={s.id}>
                <Link
                  href={`/study/${s.id}`}
                  className={cn(
                    "flex items-center gap-4 rounded-card border p-4 transition-all sm:p-5",
                    isNext ? "border-ink bg-surface shadow-md" : "border-border bg-surface hover:shadow-sm",
                    done && "opacity-60",
                  )}
                >
                  <div className="w-20 shrink-0">
                    <p className={cn("text-sm font-bold", isNext ? "text-brand" : "text-ink")}>{friendlyDate(s.scheduled_date, today)}</p>
                    {overdue && <p className="text-xs text-muted">ej gjort</p>}
                  </div>
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", done ? "bg-good text-white" : s.kind === "learn" ? "bg-surface-muted text-ink" : "bg-brand-soft text-brand")}>
                    {done ? <Check className="size-5" /> : <Icon className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{s.title}</p>
                    <p className="truncate text-sm text-muted">{s.goal}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-ink">{s.estimated_minutes} min</p>
                    {s.status === "in_progress" && <Badge tone="brand">Påbörjat</Badge>}
                  </div>
                </Link>
              </li>
            );
          })}
          <li className="flex items-center gap-4 rounded-card border border-dashed border-border-strong p-4 text-muted sm:p-5">
            <Flag className="size-5" /> <span className="font-semibold">Provdagen</span>
          </li>
        </ol>
      </section>

      <section>
        <button type="button" onClick={() => setShowWhy((v) => !v)} className="flex w-full items-center justify-between rounded-lg bg-surface-muted px-5 py-4 text-left font-semibold text-ink">
          Varför ser planen ut så här?
          <ChevronDown className={cn("size-5 transition-transform", showWhy && "rotate-180")} />
        </button>
        {showWhy && (
          <div className="mt-4 flex flex-col gap-8">
            <div>
              <p className="mb-3 text-sm text-muted">
                Prioritet = 40 % viktighet + 40 % kunskapslucka × säkerhet + 20 % hur mycket annat som bygger på området. Områden du redan kan säkert repeteras bara.
              </p>
              <ul className="flex flex-col gap-2">
                {priorities.map((p) => (
                  <li key={p.topic_id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
                    <span className="w-10 shrink-0 text-right font-bold tabular-nums text-ink">{Math.round(p.priority * 100)}</span>
                    <span className="min-w-0 flex-1 font-semibold text-ink">{p.title}</span>
                    <span className="hidden text-xs text-muted sm:block">
                      viktighet {Math.round(p.importance * 100)} · lucka {Math.round(p.gap * 100)} · säkerhet {Math.round(p.certainty * 100)}
                    </span>
                    <Badge tone={p.decision === "maintain" ? "good" : p.decision === "learn_deep" ? "brand" : "neutral"}>
                      {p.decision === "maintain" ? "Repeteras" : p.decision === "learn_deep" ? "Två pass" : "Ett pass"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 font-semibold text-ink">Anpassningar under passen</h3>
              {decisions.length === 0 ? (
                <p className="text-sm text-muted">Inga anpassningar ännu. När du övar anpassar vi nästa steg efter dina svar, och varje beslut syns här.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {decisions.map((d) => (
                    <li key={d.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info">{ACTION_LABEL[d.action] ?? d.action}</Badge>
                        {d.topic && <span className="font-semibold text-ink">{d.topic}</span>}
                        <span className="text-xs text-subtle">{new Date(d.created_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      <p className="mt-1.5 text-muted">{d.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

