/** Client-safe constants for assessment dimensions (no server imports). */
export const DIMENSIONS = ["correctness", "understanding", "method", "reasoning", "terminology", "completeness"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type Level = "strong" | "ok" | "weak" | "missing" | "not_applicable";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  correctness: "Korrekthet",
  understanding: "Förståelse",
  method: "Metod",
  reasoning: "Resonemang",
  terminology: "Begrepp",
  completeness: "Fullständighet",
};
