import type { Checkpoint, Scene } from "./schema";

export type CheckpointResult = {
  correct: boolean;
  decision: "continue" | "insert_micro_lesson";
  explanation: string;
  correctOption: string | null;
  misconception: string | null;
  remedyScenes: Scene[];
};

/**
 * Checkpoint decision (deterministic):
 *   correct                                 → continue
 *   wrong + option reveals a misconception  → insert_micro_lesson
 *   wrong twice on the same checkpoint      → insert_micro_lesson
 *   otherwise                               → show explanation, continue
 */
export function checkpointDecision(cp: Pick<Checkpoint, "correct_index" | "misconception_by_option">, choice: number, attempt: number) {
  const correct = choice === cp.correct_index;
  const misconception = correct ? null : (cp.misconception_by_option[choice] ?? null);
  const decision: CheckpointResult["decision"] = !correct && (misconception || attempt >= 2) ? "insert_micro_lesson" : "continue";
  return { correct, misconception, decision };
}

/** Local evaluation used by the public demo lessons (no database). */
export function evaluateCheckpointLocally(cp: Checkpoint, choice: number, attempt: number): CheckpointResult {
  const r = checkpointDecision(cp, choice, attempt);
  return {
    ...r,
    explanation: cp.explanation,
    correctOption: r.correct || attempt >= 2 ? cp.options[cp.correct_index] : null,
    remedyScenes: r.decision === "insert_micro_lesson" ? cp.remedy_scenes : [],
  };
}

/** What the browser gets: no answer key. */
export type PlayerCheckpoint = { id: string; after_scene: number; question: string; options: string[] };
