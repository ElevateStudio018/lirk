"use client";

import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, FileText, Lightbulb, Quote, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { STATUS_STYLES, StatusDot } from "@/components/study/topic-status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { MasteryStatus } from "@/lib/engine/mastery";
import { STATUS_LABEL } from "@/lib/engine/mastery";
import { cn } from "@/lib/utils";

type Topic = {
  id: string;
  parent_id: string | null;
  title: string;
  description: string;
  importance: number;
  difficulty: number;
  evidence_type: "explicit" | "inferred";
  inference_reason: string | null;
  evidence: Array<{ source_material_id: string; quote: string; verified: boolean }>;
  required_skills: string[];
  likely_question_types: string[];
  prerequisite_ids: string[];
  status: MasteryStatus;
};

const CATEGORY: Record<string, string> = {
  planning: "Planering",
  criteria: "Betygskriterier",
  notes: "Anteckningar",
  teacher_said: "Läraren sa",
  other: "Material",
};

function Importance({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Viktighet ${value} av 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= value ? "bg-ink" : "bg-surface-sunken")} />
      ))}
    </span>
  );
}

export function EvidenceBadge({ type }: { type: "explicit" | "inferred" }) {
  return type === "explicit" ? (
    <Badge tone="info">
      <BadgeCheck /> Står i underlaget
    </Badge>
  ) : (
    <Badge tone="warn">
      <Lightbulb /> Appens bedömning
    </Badge>
  );
}

export function TopicMap({
  projectId,
  status,
  summary,
  warnings,
  hasCriteria,
  topics,
  materials,
}: {
  projectId: string;
  status: string;
  summary: string | null;
  warnings: string[];
  hasCriteria: boolean;
  topics: Topic[];
  materials: Record<string, { filename: string; category: string }>;
}) {
  const [open, setOpen] = useState<Topic | null>(null);
  const byId = new Map(topics.map((t) => [t.id, t]));
  const roots = topics.filter((t) => !t.parent_id || !byId.has(t.parent_id));
  const children = (id: string) => topics.filter((t) => t.parent_id === id);
  const measured = topics.some((t) => t.status !== "unknown");
  const explicitCount = topics.filter((t) => t.evidence_type === "explicit").length;

  const card = (t: Topic, i: number, nested = false) => (
    <motion.button
      key={t.id}
      type="button"
      onClick={() => setOpen(t)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3 }}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-card border bg-surface p-5 text-left shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md",
        t.evidence_type === "inferred" ? "border-dashed border-border-strong" : "border-border",
        nested && "rounded-lg p-4",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("font-semibold tracking-tight text-ink", nested ? "text-base" : "text-lg")}>{t.title}</h3>
        {measured && <StatusDot status={t.status} className="mt-2" />}
      </div>
      {!nested && <p className="line-clamp-2 text-sm text-muted">{t.description}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <EvidenceBadge type={t.evidence_type} />
        <Importance value={t.importance} />
      </div>
    </motion.button>
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-heading font-bold text-ink">Det här behöver du kunna</h2>
        {summary && <p className="mt-2 max-w-2xl text-muted">{summary}</p>}
        <p className="mt-3 text-sm text-muted">
          {explicitCount} av {topics.length} områden står uttryckligen i ditt underlag. Resten är appens bedömning av vad som sannolikt krävs – de har streckad kant.
        </p>
      </div>

      {!hasCriteria && (
        <Alert tone="warning" title="Inga betygskriterier i underlaget">
          Utan betygskriterier kan vi inte koppla dina svar till betygsstegen senare. Har du kriterierna kan du lägga till dem under Underlag.
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert tone="info" title="Bra att veta om underlaget">
          <ul className="list-disc pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {roots.map((t, i) => {
          const kids = children(t.id);
          return (
            <div key={t.id} className={cn(kids.length && "sm:col-span-2")}>
              {card(t, i)}
              {kids.length > 0 && (
                <div className="ml-4 mt-2 grid gap-2 border-l-2 border-border pl-4 sm:grid-cols-2">{kids.map((k, j) => card(k, i + j + 1, true))}</div>
              )}
            </div>
          );
        })}
      </div>

      {status === "map_ready" && (
        <div className="sticky bottom-24 lg:bottom-6">
          <Link href={`/exams/${projectId}/diagnostic`} className={cn(buttonVariants({ size: "lg", variant: "primary", block: true }), "shadow-lg")}>
            Kolla vad du redan kan <ArrowRight />
          </Link>
        </div>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={open?.title ?? ""}>
        {open && (
          <div className="flex flex-col gap-7">
            <div className="flex flex-wrap items-center gap-2">
              <EvidenceBadge type={open.evidence_type} />
              {open.status !== "unknown" && (
                <Badge className={cn(STATUS_STYLES[open.status].soft, STATUS_STYLES[open.status].text)}>{STATUS_LABEL[open.status]}</Badge>
              )}
            </div>

            <section>
              <h4 className="mb-2 font-semibold text-ink">Vad behöver jag kunna?</h4>
              <p className="text-text">{open.description}</p>
              {open.required_skills.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {open.required_skills.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-text">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" /> {s}
                    </li>
                  ))}
                </ul>
              )}
              {open.likely_question_types.length > 0 && (
                <p className="mt-3 text-sm text-muted">Troliga frågor: {open.likely_question_types.join(", ")}</p>
              )}
              {open.prerequisite_ids.length > 0 && (
                <p className="mt-2 text-sm text-muted">
                  Bygger på: {open.prerequisite_ids.map((id) => byId.get(id)?.title).filter(Boolean).join(", ")}
                </p>
              )}
            </section>

            <section>
              <h4 className="mb-2 font-semibold text-ink">Varför tror appen det?</h4>
              {open.evidence_type === "explicit" ? (
                <p className="text-text">Det står uttryckligen i ditt underlag att det här ingår.</p>
              ) : (
                <p className="text-text">
                  Det här står inte uttryckligen i underlaget. Det är appens bedömning:{" "}
                  <span className="text-muted">{open.inference_reason ?? "området krävs sannolikt för att klara det som står i underlaget."}</span>
                </p>
              )}
              <p className="mt-2 text-sm text-muted">
                Viktighet {open.importance}/5 · Svårighet {open.difficulty}/5
              </p>
            </section>

            <section>
              <h4 className="mb-3 font-semibold text-ink">Vilket underlag kommer detta från?</h4>
              {open.evidence.length === 0 ? (
                <p className="text-sm text-muted">Inget direkt citat – området är härlett från helheten.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {open.evidence.map((e, i) => {
                    const m = materials[e.source_material_id];
                    return (
                      <li key={i} className="rounded-lg bg-surface-muted p-4">
                        <p className="flex gap-2 text-sm text-ink">
                          <Quote className="mt-0.5 size-4 shrink-0 text-subtle" /> <span>{e.quote}</span>
                        </p>
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <FileText className="size-3.5" /> {m?.filename ?? "Borttaget material"} · {CATEGORY[m?.category ?? "other"]}
                          {!e.verified && (
                            <span className="inline-flex items-center gap-1 text-warn">
                              <TriangleAlert className="size-3.5" /> kunde inte hittas ordagrant
                            </span>
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </Sheet>
    </div>
  );
}
