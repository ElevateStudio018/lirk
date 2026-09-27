/**
 * Subject profiles describe how a subject is typically tested in Swedish
 * compulsory/upper-secondary school. They steer question generation so that
 * the architecture is not hard-coded to any single subject.
 */

export type SubjectFamily = "math" | "science" | "social" | "language" | "other";

export type SubjectProfile = {
  name: string;
  family: SubjectFamily;
  emoji: string;
  /** How the subject is typically examined – injected into AI prompts. */
  assessmentStyle: string;
  /** Preferred mix of question types for mock exams. */
  mockExamMix: Array<{ type: string; share: number }>;
};

const FAMILY_STYLE: Record<SubjectFamily, Omit<SubjectProfile, "name" | "emoji" | "family">> = {
  math: {
    assessmentStyle:
      "Matematikprov i svensk skola: beräkningar där metod och redovisning bedöms, problemlösning i flera steg, ibland resonemang/motivering. Svar ska kunna kontrolleras exakt.",
    mockExamMix: [
      { type: "numeric", share: 0.35 },
      { type: "step_by_step", share: 0.35 },
      { type: "mcq", share: 0.1 },
      { type: "reasoning", share: 0.2 },
    ],
  },
  science: {
    assessmentStyle:
      "NO-prov: begreppsfrågor, förklaringar av samband och processer, resonemang med orsak–verkan, ibland tolkning av diagram och enkla beräkningar. Korrekt terminologi värderas.",
    mockExamMix: [
      { type: "mcq", share: 0.2 },
      { type: "short_answer", share: 0.25 },
      { type: "explain", share: 0.3 },
      { type: "reasoning", share: 0.25 },
    ],
  },
  social: {
    assessmentStyle:
      "SO-prov: begrepp, förklaringar av orsaker och konsekvenser, resonemang ur flera perspektiv, källkritik och jämförelser. Betygsstegen skiljer ofta på enkla, utvecklade och välutvecklade resonemang.",
    mockExamMix: [
      { type: "mcq", share: 0.15 },
      { type: "short_answer", share: 0.25 },
      { type: "explain", share: 0.3 },
      { type: "reasoning", share: 0.3 },
    ],
  },
  language: {
    assessmentStyle:
      "Språkprov: läsförståelse, ordförråd, grammatik i sammanhang och egen skriven produktion. Frågorna ska vara anpassade till språket som studeras.",
    mockExamMix: [
      { type: "mcq", share: 0.3 },
      { type: "short_answer", share: 0.3 },
      { type: "explain", share: 0.4 },
    ],
  },
  other: {
    assessmentStyle: "Blandat prov: begreppsfrågor, förklaringar och tillämpning. Anpassa till hur materialet beskriver bedömningen.",
    mockExamMix: [
      { type: "mcq", share: 0.25 },
      { type: "short_answer", share: 0.25 },
      { type: "explain", share: 0.25 },
      { type: "reasoning", share: 0.25 },
    ],
  },
};

const SUBJECTS: Array<{ name: string; family: SubjectFamily; emoji: string }> = [
  { name: "Matematik", family: "math", emoji: "➗" },
  { name: "Fysik", family: "science", emoji: "⚛️" },
  { name: "Kemi", family: "science", emoji: "🧪" },
  { name: "Biologi", family: "science", emoji: "🌱" },
  { name: "Geografi", family: "social", emoji: "🌍" },
  { name: "Historia", family: "social", emoji: "🏛️" },
  { name: "Samhällskunskap", family: "social", emoji: "🗳️" },
  { name: "Svenska", family: "language", emoji: "📖" },
  { name: "Engelska", family: "language", emoji: "💬" },
];

export const SUBJECT_OPTIONS = [...SUBJECTS.map((s) => s.name), "Annat"];

export function getSubjectProfile(subject: string): SubjectProfile {
  const known = SUBJECTS.find((s) => s.name.toLowerCase() === subject.trim().toLowerCase());
  const family = known?.family ?? "other";
  return { name: subject, family, emoji: known?.emoji ?? "📚", ...FAMILY_STYLE[family] };
}
