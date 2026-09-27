/** Compact topic descriptions for prompts. */
export type PromptTopic = {
  key: string;
  title: string;
  description: string;
  importance: number;
  difficulty: number;
  assessment_dimension: string;
  required_skills: string[];
  likely_question_types: string[];
  evidence_quotes?: string[];
};

export function topicsBlock(topics: PromptTopic[]): string {
  return topics
    .map(
      (t) =>
        `- key: ${t.key}
  titel: ${t.title}
  beskrivning: ${t.description}
  viktighet: ${t.importance}/5, svårighet: ${t.difficulty}/5, dimension: ${t.assessment_dimension}
  förmågor: ${t.required_skills.join("; ") || "–"}
  troliga frågetyper: ${t.likely_question_types.join("; ") || "–"}${
    t.evidence_quotes?.length ? `\n  ur underlaget: ${t.evidence_quotes.map((q) => `"${q}"`).join(" ")}` : ""
  }`,
    )
    .join("\n");
}

/** Jaccard similarity of word sets – used to avoid re-using questions. */
export function similarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function tooSimilar(prompt: string, previous: string[], threshold = 0.75): string | null {
  return previous.find((p) => similarity(prompt, p) >= threshold) ?? null;
}
