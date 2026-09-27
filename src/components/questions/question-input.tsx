"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import type { Answer, PublicQuestion } from "@/lib/domain/questions";
import { cn } from "@/lib/utils";

type Props = {
  question: PublicQuestion;
  value: Answer | null;
  onChange: (answer: Answer) => void;
  disabled?: boolean;
  /** Result coloring for mcq after grading. */
  reveal?: { correctText?: string | null } | null;
};

/** Initial answer for types whose "empty" state is itself a valid structure. */
export function initialAnswer(q: PublicQuestion): Answer | null {
  if (q.type === "order_steps") return { kind: "order", order: q.steps.map((_, i) => i) };
  if (q.type === "match_concepts") return { kind: "matches", matches: q.left.map(() => -1) };
  return null;
}

export function isAnswerComplete(q: PublicQuestion, a: Answer | null): boolean {
  if (!a) return false;
  switch (a.kind) {
    case "choice":
      return true;
    case "text":
      return a.text.trim().length > 0;
    case "error_step":
      return a.step >= 0;
    case "order":
      return true;
    case "matches":
      return q.type === "match_concepts" && a.matches.every((m) => m >= 0);
  }
}

export function QuestionInput({ question: q, value, onChange, disabled }: Props) {
  switch (q.type) {
    case "mcq": {
      const choice = value?.kind === "choice" ? value.choice : null;
      return (
        <div className="grid gap-2" role="radiogroup">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={choice === i}
              disabled={disabled}
              onClick={() => onChange({ kind: "choice", choice: i })}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left text-[15px] font-medium transition-all disabled:cursor-default",
                choice === i ? "border-ink bg-surface shadow-md" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold", choice === i ? "border-ink bg-primary text-on-primary" : "border-border-strong text-muted")}>
                {choice === i ? <Check className="size-3.5" /> : String.fromCharCode(65 + i)}
              </span>
              <span className="text-ink">{opt}</span>
            </button>
          ))}
        </div>
      );
    }

    case "numeric":
      return (
        <div className="flex items-center gap-3">
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={value?.kind === "text" ? value.text : ""}
            onChange={(e) => onChange({ kind: "text", text: e.target.value })}
            disabled={disabled}
            placeholder="Ditt svar"
            className="h-14 max-w-60 text-lg tabular-nums"
            aria-label="Ditt svar"
          />
          {q.unit && <span className="text-lg font-semibold text-muted">{q.unit}</span>}
        </div>
      );

    case "order_steps": {
      const order = value?.kind === "order" ? value.order : q.steps.map((_, i) => i);
      const move = (idx: number, dir: -1 | 1) => {
        const next = [...order];
        const j = idx + dir;
        if (j < 0 || j >= next.length) return;
        [next[idx], next[j]] = [next[j], next[idx]];
        onChange({ kind: "order", order: next });
      };
      return (
        <ol className="flex flex-col gap-2">
          {order.map((displayIdx, i) => (
            <li key={displayIdx} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 pl-4">
              <span className="w-5 shrink-0 text-sm font-bold text-muted">{i + 1}</span>
              <span className="flex-1 text-[15px] text-ink">{q.steps[displayIdx]}</span>
              <div className="flex shrink-0 flex-col">
                <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface-muted disabled:opacity-30" aria-label="Flytta upp">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface-muted disabled:opacity-30" aria-label="Flytta ner">
                  <ArrowDown className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      );
    }

    case "match_concepts": {
      const matches = value?.kind === "matches" ? value.matches : q.left.map(() => -1);
      return (
        <div className="flex flex-col gap-3">
          {q.left.map((l, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="font-semibold text-ink sm:w-2/5">{l}</span>
              <select
                value={matches[i]}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...matches];
                  next[i] = Number(e.target.value);
                  onChange({ kind: "matches", matches: next });
                }}
                className="h-11 flex-1 rounded-md border border-border bg-surface px-3 text-[15px] text-ink"
                aria-label={`Välj vad som hör ihop med ${l}`}
              >
                <option value={-1}>Välj…</option>
                {q.right.map((r, j) => (
                  <option key={j} value={j}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    case "find_the_error": {
      const step = value?.kind === "error_step" ? value.step : -1;
      const text = value?.kind === "error_step" ? value.text : "";
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Tryck på steget där det blir fel.</p>
          <ol className="flex flex-col gap-2">
            {q.steps.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ kind: "error_step", step: i, text })}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left font-mono text-[15px] transition-all",
                    step === i ? "border-bad bg-bad-soft" : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <span className="w-5 shrink-0 font-sans text-sm font-bold text-muted">{i + 1}</span>
                  <span className="text-ink">{s}</span>
                </button>
              </li>
            ))}
          </ol>
          {step >= 0 && (
            <Textarea
              value={text}
              disabled={disabled}
              onChange={(e) => onChange({ kind: "error_step", step, text: e.target.value })}
              placeholder="Hur borde det stå? (valfritt)"
              className="min-h-20"
            />
          )}
        </div>
      );
    }

    default:
      return (
        <Textarea
          value={value?.kind === "text" ? value.text : ""}
          onChange={(e) => onChange({ kind: "text", text: e.target.value })}
          disabled={disabled}
          placeholder={q.type === "short_answer" ? "Skriv ett kort svar" : q.type === "step_by_step" ? "Skriv din lösning steg för steg, en rad per steg" : "Förklara med egna ord"}
          className={cn(q.type === "short_answer" ? "min-h-20" : "min-h-40")}
          aria-label="Ditt svar"
        />
      );
  }
}
