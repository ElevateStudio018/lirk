import { z } from "zod";

/**
 * A study session is a list of activities ("items"). The plan engine creates the
 * initial items; the adaptive engine may append/insert items while the student
 * works. Content (lessons, exercise sets, mock exams) is generated lazily when an
 * item becomes current, and its id is stored in `ref_id`.
 */
export const ITEM_KINDS = [
  "lesson",
  "micro_lesson",
  "example",
  "practice",
  "review",
  "harder",
  "easier",
  "confirmation",
  "mock_exam",
  "final_exam",
] as const;
export const ItemKind = z.enum(ITEM_KINDS);
export type ItemKind = z.infer<typeof ItemKind>;

export const SessionItem = z.object({
  id: z.string(),
  kind: ItemKind,
  topic_id: z.string().nullable(),
  topic_ids: z.array(z.string()).default([]),
  minutes: z.number(),
  label: z.string(),
  status: z.enum(["pending", "done", "skipped"]).default("pending"),
  ref_id: z.string().nullable().default(null),
  origin: z.enum(["plan", "adaptive", "remediation"]).default("plan"),
  decision_id: z.string().nullable().default(null),
  /** Extra instructions for content generation, e.g. the misconception to fix. */
  focus: z.string().nullable().default(null),
  remediation_target_id: z.string().nullable().default(null),
});
export type SessionItem = z.infer<typeof SessionItem>;
export type SessionItemInput = z.input<typeof SessionItem>;

export const SessionItems = z.array(SessionItem);

export function parseItems(json: unknown): SessionItem[] {
  const parsed = SessionItems.safeParse(json);
  return parsed.success ? parsed.data : [];
}

export const ITEM_LABELS: Record<ItemKind, string> = {
  lesson: "Lektion",
  micro_lesson: "Mikrolektion",
  example: "Lösta exempel",
  practice: "Öva",
  review: "Repetition",
  harder: "Utmaning",
  easier: "Enklare steg",
  confirmation: "Kontrollfråga",
  mock_exam: "Övningsprov",
  final_exam: "Slutprov",
};

export function newItemId(prefix = "it") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
