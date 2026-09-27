import { z } from "zod";

/**
 * Scene schema for the automatic motion-graphics lessons.
 *
 * The AI writes JSON in exactly this shape; the renderer (src/remotion) maps each
 * `type` to a React scene component. No generated images or video – every visual
 * is built from text, SVG, CSS and simple diagrams.
 *
 * The schema doubles as the OpenAI Structured Output schema, so every field is
 * required and optionality is expressed with `.nullable()`.
 */

export const SCENE_TYPES = [
  "title",
  "concept",
  "big-number",
  "comparison",
  "timeline",
  "process",
  "cause-effect",
  "equation",
  "graph",
  "quote",
  "definition",
  "memory-trick",
  "misconception",
  "example",
  "summary",
  "question-transition",
] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

/** Icons the AI may reference. Mapped to lucide-react components in the renderer. */
export const SCENE_ICONS = [
  "sun",
  "cloud",
  "thermometer",
  "globe",
  "factory",
  "car",
  "leaf",
  "tree",
  "droplet",
  "flame",
  "snowflake",
  "wind",
  "zap",
  "atom",
  "flask",
  "calculator",
  "sigma",
  "scale",
  "book",
  "lightbulb",
  "target",
  "check",
  "alert",
  "users",
  "landmark",
  "clock",
  "arrow-up",
  "arrow-down",
  "heart",
  "brain",
  "map",
  "coins",
] as const;
export const SceneIcon = z.enum(SCENE_ICONS);

export const Transition = z.enum(["fade", "slide", "zoom", "none"]);
export const AnimationStyle = z
  .enum(["reveal", "sequential", "zoom-in", "pan", "pulse", "draw"])
  .describe("Hur innehållet animeras in. Välj det som hjälper förståelsen.");

const common = {
  duration: z.number().min(2).max(30).describe("Sekunder. Räcker för att läsa upp narration i lugnt tempo."),
  headline: z.string().describe("Kort rubrik, max ca 8 ord"),
  subheadline: z.string().nullable(),
  narration: z.string().describe("Det rösten säger under scenen. 1–3 meningar, talspråk, svenska."),
  emphasis: z.array(z.string()).describe("Nyckelord som ska markeras visuellt; måste finnas ordagrant i scenens text"),
  transition: Transition,
  animation: AnimationStyle,
};

export const TitleScene = z.object({
  type: z.literal("title"),
  ...common,
  visual: z.object({ kicker: z.string().nullable(), icon: SceneIcon.nullable() }),
});

export const ConceptScene = z.object({
  type: z.literal("concept"),
  ...common,
  visual: z.object({
    points: z
      .array(z.object({ label: z.string(), detail: z.string().nullable(), icon: SceneIcon.nullable() }))
      .min(1)
      .max(4),
  }),
});

export const BigNumberScene = z.object({
  type: z.literal("big-number"),
  ...common,
  visual: z.object({
    value: z.number(),
    decimals: z.number().int().min(0).max(3),
    prefix: z.string().nullable(),
    suffix: z.string().nullable(),
    caption: z.string(),
  }),
});

const ComparisonSide = z.object({
  title: z.string(),
  items: z.array(z.string()).min(1).max(5),
  icon: SceneIcon.nullable(),
});
export const ComparisonScene = z.object({
  type: z.literal("comparison"),
  ...common,
  visual: z.object({ left: ComparisonSide, right: ComparisonSide, verdict: z.string().nullable() }),
});

export const TimelineScene = z.object({
  type: z.literal("timeline"),
  ...common,
  visual: z.object({
    events: z.array(z.object({ time: z.string(), label: z.string(), detail: z.string().nullable() })).min(2).max(6),
  }),
});

export const ProcessScene = z.object({
  type: z.literal("process"),
  ...common,
  visual: z.object({
    steps: z.array(z.object({ label: z.string(), detail: z.string().nullable(), icon: SceneIcon.nullable() })).min(2).max(6),
    cyclic: z.boolean().describe("true om sista steget leder tillbaka till första"),
  }),
});

export const CauseEffectScene = z.object({
  type: z.literal("cause-effect"),
  ...common,
  visual: z.object({
    chain: z
      .array(z.object({ label: z.string(), detail: z.string().nullable(), icon: SceneIcon.nullable() }))
      .min(2)
      .max(5)
      .describe("Orsakskedja: varje led orsakar nästa"),
  }),
});

export const EquationScene = z.object({
  type: z.literal("equation"),
  ...common,
  visual: z.object({
    lines: z
      .array(
        z.object({
          expression: z.string().describe("Uttryck i klartext, t.ex. 2x + 3 = 11. Använd * för multiplikation och / för division."),
          note: z.string().nullable().describe("Kort kommentar till höger, t.ex. '−3 på båda sidor'"),
          highlight: z.string().nullable().describe("Del av uttrycket som ska markeras, ordagrant"),
        }),
      )
      .min(1)
      .max(6),
  }),
});

export const GraphScene = z.object({
  type: z.literal("graph"),
  ...common,
  visual: z.object({
    kind: z.enum(["line", "bar"]),
    x_label: z.string(),
    y_label: z.string(),
    series: z
      .array(
        z.object({
          name: z.string(),
          points: z.array(z.object({ x: z.string(), y: z.number() })).min(2).max(12),
        }),
      )
      .min(1)
      .max(2),
    source_note: z.string().nullable().describe("Varifrån siffrorna kommer, eller 'Förenklat exempel'"),
  }),
});

export const QuoteScene = z.object({
  type: z.literal("quote"),
  ...common,
  visual: z.object({ text: z.string(), attribution: z.string().nullable() }),
});

export const DefinitionScene = z.object({
  type: z.literal("definition"),
  ...common,
  visual: z.object({ term: z.string(), definition: z.string(), example: z.string().nullable() }),
});

export const MemoryTrickScene = z.object({
  type: z.literal("memory-trick"),
  ...common,
  visual: z.object({ mnemonic: z.string(), explanation: z.string() }),
});

export const MisconceptionScene = z.object({
  type: z.literal("misconception"),
  ...common,
  visual: z.object({ wrong: z.string(), right: z.string(), why: z.string() }),
});

export const ExampleScene = z.object({
  type: z.literal("example"),
  ...common,
  visual: z.object({ problem: z.string(), steps: z.array(z.string()).min(1).max(6), answer: z.string() }),
});

export const SummaryScene = z.object({
  type: z.literal("summary"),
  ...common,
  visual: z.object({ points: z.array(z.string()).min(2).max(5) }),
});

export const QuestionTransitionScene = z.object({
  type: z.literal("question-transition"),
  ...common,
  visual: z.object({ question: z.string(), hint: z.string().nullable() }),
});

export const Scene = z.discriminatedUnion("type", [
  TitleScene,
  ConceptScene,
  BigNumberScene,
  ComparisonScene,
  TimelineScene,
  ProcessScene,
  CauseEffectScene,
  EquationScene,
  GraphScene,
  QuoteScene,
  DefinitionScene,
  MemoryTrickScene,
  MisconceptionScene,
  ExampleScene,
  SummaryScene,
  QuestionTransitionScene,
]);
export type Scene = z.infer<typeof Scene>;
export type SceneOf<T extends SceneType> = Extract<Scene, { type: T }>;

/** Simpler scene subset used for remedial micro-lessons inside checkpoints. */
export const RemedyScene = z.discriminatedUnion("type", [
  ConceptScene,
  DefinitionScene,
  MisconceptionScene,
  ExampleScene,
  EquationScene,
  CauseEffectScene,
  MemoryTrickScene,
]);

export const Checkpoint = z.object({
  id: z.string(),
  after_scene: z.number().int().min(0).describe("Index på scenen som checkpointen kommer efter (0-baserat)"),
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  correct_index: z.number().int().min(0),
  explanation: z.string().describe("Kort förklaring som visas vid fel svar"),
  misconception_by_option: z
    .array(z.string().nullable())
    .describe("Samma längd som options: vilken missuppfattning ett fel alternativ avslöjar, annars null"),
  remedy_scenes: z
    .array(RemedyScene)
    .min(1)
    .max(3)
    .describe("Kort mikrolektion (1–3 scener) som spelas upp om eleven visar en missuppfattning"),
});
export type Checkpoint = z.infer<typeof Checkpoint>;

export const Lesson = z.object({
  title: z.string(),
  scenes: z.array(Scene).min(3).max(14),
  checkpoints: z.array(Checkpoint).max(3),
});
export type Lesson = z.infer<typeof Lesson>;

/** Micro-lesson / worked example generated on demand by the adaptive engine. */
export const MicroLesson = z.object({
  title: z.string(),
  scenes: z.array(Scene).min(2).max(6),
});
export type MicroLesson = z.infer<typeof MicroLesson>;

/**
 * Checks invariants that JSON Schema cannot express and repairs what can be
 * repaired safely. Returns the fixed lesson plus a list of problems that were
 * fatal (empty list = valid).
 */
export function validateLesson(lesson: Lesson): { lesson: Lesson; problems: string[] } {
  const problems: string[] = [];
  const scenes = lesson.scenes.map(sanitizeScene);
  const checkpoints = lesson.checkpoints
    .filter((c) => {
      if (c.correct_index >= c.options.length) {
        problems.push(`checkpoint ${c.id}: correct_index utanför options`);
        return false;
      }
      return true;
    })
    .map((c) => {
      const m = c.misconception_by_option.slice(0, c.options.length);
      while (m.length < c.options.length) m.push(null);
      return {
        ...c,
        after_scene: Math.min(Math.max(0, c.after_scene), scenes.length - 1),
        misconception_by_option: m.map((x, i) => (i === c.correct_index ? null : x)),
        remedy_scenes: c.remedy_scenes.map(sanitizeScene) as Checkpoint["remedy_scenes"],
      };
    })
    .sort((a, b) => a.after_scene - b.after_scene);
  // Only one checkpoint per scene boundary.
  const seen = new Set<number>();
  const unique = checkpoints.filter((c) => (seen.has(c.after_scene) ? false : (seen.add(c.after_scene), true)));
  return { lesson: { ...lesson, scenes, checkpoints: unique }, problems };
}

/** Removes emphasis terms that do not occur in the scene and clamps durations. */
export function sanitizeScene<S extends Scene>(scene: S): S {
  const text = JSON.stringify([scene.headline, scene.subheadline, scene.visual]).toLowerCase();
  return {
    ...scene,
    duration: Math.min(30, Math.max(2, scene.duration)),
    emphasis: scene.emphasis.filter((e) => e.trim() && text.includes(e.trim().toLowerCase())).slice(0, 4),
  };
}
