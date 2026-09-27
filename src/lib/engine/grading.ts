import { seededPermutation, type Answer, type Question } from "@/lib/domain/questions";

/**
 * Deterministic grading for question types with an exact answer key.
 * Open answers (explanations, reasoning, step-by-step) are graded by the AI
 * grader instead – see lib/ai/tasks/grade.ts.
 */

export type ErrorType =
  | "none"
  | "calculation"
  | "sign_error"
  | "method"
  | "concept"
  | "misconception"
  | "incomplete"
  | "terminology"
  | "reading"
  | "prerequisite"
  | "other";

export type GradeResult = {
  score: number; // 0–1
  is_correct: boolean;
  feedback: string;
  error_type: ErrorType;
  misconception: string | null;
  prerequisite_gap: boolean;
  method: "deterministic" | "ai";
  /** Shown after answering: the correct answer in readable form. */
  correct_answer: string;
};

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[.,;:!?"'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses Swedish/English number formats: "3,5", "−2", "1 200", "x = 4", "4 cm". */
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/[−–]/g, "-").replace(/ /g, " ");
  const eq = s.lastIndexOf("=");
  if (eq >= 0) s = s.slice(eq + 1);
  const match = s.match(/-?\s*\d[\d\s]*(?:[.,]\d+)?(?:\s*\/\s*\d+)?/);
  if (!match) return null;
  let token = match[0].replace(/\s+/g, "");
  if (token.includes("/")) {
    const [a, b] = token.split("/");
    const num = Number(a.replace(",", "."));
    const den = Number(b.replace(",", "."));
    return den === 0 || !Number.isFinite(num / den) ? null : num / den;
  }
  // "1,200" is ambiguous; in Swedish school math the comma is a decimal separator.
  token = token.replace(",", ".");
  const v = Number(token);
  return Number.isFinite(v) ? v : null;
}

export function canGradeDeterministically(q: Question, answer: Answer): boolean {
  switch (q.type) {
    case "mcq":
      return answer.kind === "choice";
    case "numeric":
      return answer.kind === "text";
    case "order_steps":
      return answer.kind === "order";
    case "match_concepts":
      return answer.kind === "matches";
    case "find_the_error":
      return answer.kind === "error_step";
    case "short_answer":
      // Exact matches are graded here; anything else goes to the AI grader.
      return answer.kind === "text" && matchesAccepted(q, answer.text);
    default:
      return false;
  }
}

function matchesAccepted(q: Extract<Question, { type: "short_answer" }>, text: string) {
  const t = normalizeText(text);
  if (!t) return false;
  return [q.expected_answer, ...q.accepted_answers].some((a) => normalizeText(a) === t);
}

export function correctAnswerText(q: Question): string {
  switch (q.type) {
    case "mcq":
      return q.options[q.correct_index] ?? "";
    case "numeric":
      return `${formatNumber(q.answer_value)}${q.unit ? ` ${q.unit}` : ""}`;
    case "short_answer":
      return q.expected_answer;
    case "step_by_step":
      return q.final_answer;
    case "explain":
    case "reasoning":
      return q.key_points.join(" · ");
    case "find_the_error":
      return `Steg ${q.error_step_index + 1}: ${q.correction}`;
    case "order_steps":
      return q.steps.map((s, i) => `${i + 1}. ${s}`).join("  ");
    case "match_concepts":
      return q.pairs.map((p) => `${p.left} → ${p.right}`).join(" · ");
  }
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000).replace(".", ",");
}

/**
 * @param seed The same seed that was used to shuffle the question for display
 *             (see toPublicQuestion). Needed for order/match questions.
 */
export function gradeDeterministic(q: Question, answer: Answer, seed: string): GradeResult {
  const correct_answer = correctAnswerText(q);
  const base = { method: "deterministic" as const, prerequisite_gap: false, correct_answer };

  switch (q.type) {
    case "mcq": {
      if (answer.kind !== "choice") break;
      const ok = answer.choice === q.correct_index;
      const misconception = ok ? null : (q.misconception_by_option[answer.choice] ?? null);
      return {
        ...base,
        score: ok ? 1 : 0,
        is_correct: ok,
        feedback: ok
          ? q.explanation
          : misconception
            ? `Det alternativet bygger på en vanlig missuppfattning: ${misconception}. ${q.explanation}`
            : `Rätt svar är "${correct_answer}". ${q.explanation}`,
        error_type: ok ? "none" : misconception ? "misconception" : "concept",
        misconception,
      };
    }

    case "numeric": {
      if (answer.kind !== "text") break;
      const value = parseNumber(answer.text);
      if (value === null) {
        return {
          ...base,
          score: 0,
          is_correct: false,
          feedback: "Jag hittade inget tal i ditt svar. Skriv svaret som ett tal, t.ex. 4 eller 3,5.",
          error_type: "reading",
          misconception: null,
        };
      }
      const tol = Math.max(q.tolerance, 1e-9);
      const ok = Math.abs(value - q.answer_value) <= tol;
      const signFlip = !ok && Math.abs(value + q.answer_value) <= tol && q.answer_value !== 0;
      const solution = q.worked_solution.length ? ` Lösning: ${q.worked_solution.join(" → ")}` : "";
      return {
        ...base,
        score: ok ? 1 : 0,
        is_correct: ok,
        feedback: ok
          ? `Rätt, ${correct_answer}.`
          : signFlip
            ? `Du fick ${formatNumber(value)} men svaret är ${correct_answer} – det ser ut som att ett minustecken har tappats någonstans.${solution}`
            : `Du svarade ${formatNumber(value)}, rätt svar är ${correct_answer}.${solution}`,
        error_type: ok ? "none" : signFlip ? "sign_error" : "calculation",
        misconception: null,
      };
    }

    case "short_answer": {
      if (answer.kind !== "text") break;
      const ok = matchesAccepted(q, answer.text);
      return {
        ...base,
        score: ok ? 1 : 0,
        is_correct: ok,
        feedback: ok ? "Rätt." : `Förväntat svar: ${q.expected_answer}.`,
        error_type: ok ? "none" : "concept",
        misconception: null,
      };
    }

    case "order_steps": {
      if (answer.kind !== "order") break;
      const perm = seededPermutation(q.steps.length, seed + q.id);
      const sequence = answer.order.map((displayIdx) => perm[displayIdx]);
      const n = q.steps.length;
      const valid = sequence.length === n && new Set(sequence).size === n && sequence.every((v) => v !== undefined);
      if (!valid) {
        return { ...base, score: 0, is_correct: false, feedback: "Alla steg måste vara med exakt en gång.", error_type: "incomplete", misconception: null };
      }
      let adjacent = 0;
      for (let i = 0; i < n - 1; i++) if (sequence[i + 1] === sequence[i] + 1) adjacent++;
      const placed = sequence.filter((v, i) => v === i).length;
      const ok = placed === n;
      const score = ok ? 1 : Math.round(((adjacent / (n - 1)) * 0.6 + (placed / n) * 0.4) * 100) / 100;
      const firstWrong = sequence.findIndex((v, i) => v !== i);
      return {
        ...base,
        score,
        is_correct: ok,
        feedback: ok
          ? `Rätt ordning. ${q.explanation}`
          : `${placed} av ${n} steg står på rätt plats. Första felet är på plats ${firstWrong + 1}: där ska "${q.steps[firstWrong]}" stå. ${q.explanation}`,
        error_type: ok ? "none" : "method",
        misconception: null,
      };
    }

    case "match_concepts": {
      if (answer.kind !== "matches") break;
      const perm = seededPermutation(q.pairs.length, seed + q.id);
      const correctCount = q.pairs.filter((_, left) => {
        const displayed = answer.matches[left];
        return displayed !== undefined && displayed >= 0 && perm[displayed] === left;
      }).length;
      const ok = correctCount === q.pairs.length;
      const wrong = q.pairs.filter((_, left) => perm[answer.matches[left] ?? -1] !== left).map((p) => `${p.left} → ${p.right}`);
      return {
        ...base,
        score: Math.round((correctCount / q.pairs.length) * 100) / 100,
        is_correct: ok,
        feedback: ok
          ? `Alla par stämmer. ${q.explanation}`
          : `${correctCount} av ${q.pairs.length} par stämmer. Rätt är: ${wrong.join(", ")}. ${q.explanation}`,
        error_type: ok ? "none" : "concept",
        misconception: null,
      };
    }

    case "find_the_error": {
      if (answer.kind !== "error_step") break;
      const ok = answer.step === q.error_step_index;
      return {
        ...base,
        score: ok ? 1 : 0,
        is_correct: ok,
        feedback: ok
          ? `Rätt, felet finns i steg ${q.error_step_index + 1}. ${q.explanation} Rättat: ${q.correction}`
          : `Steg ${answer.step + 1} stämmer faktiskt. Felet finns i steg ${q.error_step_index + 1}: ${q.explanation} Rättat: ${q.correction}`,
        error_type: ok ? "none" : "method",
        misconception: null,
      };
    }

    default:
      break;
  }

  throw new Error(`Question ${q.id} of type ${q.type} cannot be graded deterministically with a ${answer.kind} answer`);
}
