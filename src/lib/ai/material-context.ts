/** Helpers to put student material into prompts within a character budget. */

export type PromptMaterial = {
  id: string;
  category: string;
  type: string;
  filename: string | null;
  text: string;
};

export const CATEGORY_LABELS: Record<string, string> = {
  planning: "Lärarens planering",
  criteria: "Betygskriterier / kunskapskrav",
  notes: "Anteckningar / genomgång",
  teacher_said: "Det här har läraren sagt kommer på provet",
  student_answers: "Elevens svar på följdfrågor om provet",
  other: "Övrigt material",
};

export function materialsBlock(materials: PromptMaterial[], budget = 110_000): string {
  if (materials.length === 0) return "<material>(inget material)</material>";
  const total = materials.reduce((a, m) => a + m.text.length, 0);
  const ratio = Math.min(1, budget / Math.max(1, total));
  return materials
    .map((m) => {
      const limit = Math.max(1500, Math.floor(m.text.length * ratio));
      const text = m.text.length > limit ? `${m.text.slice(0, limit)}\n[… texten är avkortad …]` : m.text;
      return `<material source_material_id="${m.id}" kategori="${CATEGORY_LABELS[m.category] ?? m.category}" filnamn="${escapeAttr(m.filename ?? m.type)}">\n${text}\n</material>`;
    })
    .join("\n\n");
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "'").replace(/[<>]/g, "");
}

/** Whitespace/case-insensitive check that a quote really occurs in a text. */
export function quoteOccursIn(quote: string, text: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[“”„"'’‘`´]/g, "")
      .replace(/[‐-―-]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  const q = norm(quote);
  if (q.length < 4) return false;
  const t = norm(text);
  if (t.includes(q)) return true;
  // Accept a quote whose first 60 characters match (AI may trim the end).
  return q.length > 60 && t.includes(q.slice(0, 60));
}
