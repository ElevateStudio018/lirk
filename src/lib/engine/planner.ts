import { newItemId, type SessionItemInput } from "@/lib/domain/session";
import { addDays, daysBetween, isoWeekday } from "./dates";

/**
 * Study plan engine
 * =================
 * Deterministic: the same inputs always produce the same plan, and every
 * priority can be explained. No LLM involved.
 *
 *   priority = 0.40·importance + 0.40·gap·certainty + 0.20·prerequisite_weight
 *
 *   importance            importance/5 from the knowledge map
 *   gap                   1 − mastery (0.5 when unknown)
 *   certainty             how sure we are about the gap: 0.5 + 0.5·confidence
 *                         (unknown topics get 0.5 – worth checking, not ignoring)
 *   prerequisite_weight   summed importance of topics that build on this one
 *
 * The two last sessions before the exam are always:
 *   1. Mock Exam 1
 *   2. Targeted remediation + Final Mock Exam
 * Earlier sessions teach topics in prerequisite order and interleave spaced
 * repetition (1, 3, 7 days after a topic was learned).
 */

export type PlannerTopic = {
  id: string;
  title: string;
  importance: number;
  difficulty: number;
  mastery: number | null;
  confidence: number;
  prerequisiteIds: string[];
  /** A lesson on the topic was already completed (used when re-planning). */
  lessonDone?: boolean;
  lastPracticedAt?: string | null;
};

export type PlannerInput = {
  today: string;
  examDate: string;
  availableDays: number[];
  minutesPerSession: number;
  topics: PlannerTopic[];
  /** Keep mock sessions out (e.g. when mock 1 is already done). */
  includeMock1?: boolean;
  includeFinal?: boolean;
};

export type PlannedSession = {
  scheduled_date: string;
  kind: "learn" | "review" | "mock1" | "remediation_final";
  title: string;
  goal: string;
  estimated_minutes: number;
  topic_ids: string[];
  items: SessionItemInput[];
};

export type TopicPriority = {
  topic_id: string;
  title: string;
  priority: number;
  importance: number;
  gap: number;
  certainty: number;
  prerequisite_weight: number;
  decision: "learn" | "learn_deep" | "maintain";
};

export type PlanResult = {
  sessions: PlannedSession[];
  priorities: TopicPriority[];
  dropped: string[];
  notes: string[];
};

export const KNOWN_MASTERY = 0.85;
export const KNOWN_CONFIDENCE = 0.6;
const REVIEW_INTERVALS = [1, 3, 7];

export function topicPriorities(topics: PlannerTopic[]): TopicPriority[] {
  const dependents = new Map<string, number>();
  for (const t of topics) for (const p of t.prerequisiteIds) dependents.set(p, (dependents.get(p) ?? 0) + t.importance);
  const maxDep = Math.max(1, ...dependents.values());

  return topics
    .map((t) => {
      const importance = clamp01(t.importance / 5);
      const gap = t.mastery === null ? 0.5 : clamp01(1 - t.mastery);
      const certainty = t.mastery === null ? 0.5 : 0.5 + 0.5 * clamp01(t.confidence);
      const prerequisite_weight = (dependents.get(t.id) ?? 0) / maxDep;
      const priority = round(0.4 * importance + 0.4 * gap * certainty + 0.2 * prerequisite_weight);
      const known = t.mastery !== null && t.mastery >= KNOWN_MASTERY && t.confidence >= KNOWN_CONFIDENCE;
      const deep = !known && (t.difficulty >= 4 || (t.importance >= 4 && (t.mastery ?? 0) < 0.5));
      return {
        topic_id: t.id,
        title: t.title,
        priority,
        importance: round(importance),
        gap: round(gap),
        certainty: round(certainty),
        prerequisite_weight: round(prerequisite_weight),
        decision: known ? ("maintain" as const) : deep ? ("learn_deep" as const) : ("learn" as const),
      };
    })
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, "sv"));
}

/** Available study dates strictly before the exam (the exam day itself is for the exam). */
export function studyDates(today: string, examDate: string, availableDays: number[]): string[] {
  const out: string[] = [];
  const span = daysBetween(today, examDate);
  for (let i = 0; i < span; i++) {
    const d = addDays(today, i);
    if (availableDays.includes(isoWeekday(d))) out.push(d);
  }
  return out;
}

type Unit = { topicId: string; part: 1 | 2; priority: number };

function orderUnits(priorities: TopicPriority[], topics: Map<string, PlannerTopic>): Unit[] {
  const learn = priorities.filter((p) => p.decision !== "maintain" && !topics.get(p.topic_id)?.lessonDone);
  const learnIds = new Set(learn.map((p) => p.topic_id));
  const placed = new Set<string>();
  const first: Unit[] = [];
  const remaining = [...learn];
  // Prerequisites first, highest priority among the eligible.
  while (remaining.length) {
    let idx = remaining.findIndex((p) =>
      (topics.get(p.topic_id)?.prerequisiteIds ?? []).every((pre) => !learnIds.has(pre) || placed.has(pre)),
    );
    if (idx === -1) idx = 0; // cycle in prerequisites – fall back to priority order
    const [p] = remaining.splice(idx, 1);
    placed.add(p.topic_id);
    first.push({ topicId: p.topic_id, part: 1, priority: p.priority });
  }
  // Deep topics get a second, spaced unit two positions later.
  const units = [...first];
  for (const p of learn.filter((x) => x.decision === "learn_deep")) {
    const at = units.findIndex((u) => u.topicId === p.topic_id && u.part === 1);
    units.splice(Math.min(units.length, at + 3), 0, { topicId: p.topic_id, part: 2, priority: p.priority * 0.8 });
  }
  return units;
}

function lessonMinutes(t: PlannerTopic) {
  return Math.min(8, Math.max(4, Math.round(3 + t.difficulty * 0.8)));
}
function practiceMinutes(t: PlannerTopic) {
  return t.difficulty >= 4 ? 7 : 6;
}
function unitMinutes(u: Unit, t: PlannerTopic) {
  return u.part === 1 ? lessonMinutes(t) + practiceMinutes(t) : 4 + practiceMinutes(t) + 1;
}

export function planStudy(input: PlannerInput): PlanResult {
  const notes: string[] = [];
  const topics = new Map(input.topics.map((t) => [t.id, t]));
  const priorities = topicPriorities(input.topics);
  const M = Math.max(5, input.minutesPerSession);
  const includeMock1 = input.includeMock1 ?? true;
  const includeFinal = input.includeFinal ?? true;

  let dates = studyDates(input.today, input.examDate, input.availableDays);
  const reserved = (includeMock1 ? 1 : 0) + (includeFinal ? 1 : 0);
  if (dates.length < Math.max(2, reserved)) {
    const all = studyDates(input.today, input.examDate, [1, 2, 3, 4, 5, 6, 7]);
    if (all.length > dates.length) {
      dates = all;
      notes.push("Det finns få pluggdagar kvar, så vi lade till pass även på dagar du inte valt. Du bestämmer själv om du hinner.");
    }
  }
  if (dates.length === 0) {
    dates = [input.today];
    notes.push("Provet är nära – allt är samlat till idag.");
  }

  // Reserve the last dates for the mock sessions.
  const tail: Array<"mock1" | "remediation_final"> = [];
  if (includeMock1) tail.push("mock1");
  if (includeFinal) tail.push("remediation_final");
  const learnDates = dates.slice(0, Math.max(0, dates.length - tail.length));
  const tailDates =
    dates.length >= tail.length ? dates.slice(dates.length - tail.length) : tail.map((_, i) => dates[Math.min(i, dates.length - 1)]);
  if (includeMock1 && learnDates.length === 0) {
    notes.push("Kort om tid: vi går direkt på övningsprov och riktad träning av det som behövs mest.");
  }

  // ---- learning units → sessions -------------------------------------------------
  let units = orderUnits(priorities, topics);
  const avgUnit = units.length
    ? units.reduce((a, u) => a + unitMinutes(u, topics.get(u.topicId)!), 0) / units.length
    : 12;
  const perSession = Math.max(1, Math.floor((M - 3) / avgUnit));
  const capacity = learnDates.length * perSession;
  const stretchCapacity = learnDates.length * (perSession + (M >= 20 ? 1 : 0));
  const dropped: string[] = [];

  if (units.length > capacity) {
    // First drop spaced second units, lowest priority first.
    const seconds = units.filter((u) => u.part === 2).sort((a, b) => a.priority - b.priority);
    while (units.length > capacity && seconds.length) {
      const s = seconds.shift()!;
      units = units.filter((u) => u !== s);
    }
  }
  if (units.length > stretchCapacity) {
    const byPriority = [...units].sort((a, b) => a.priority - b.priority);
    while (units.length > stretchCapacity && byPriority.length) {
      const u = byPriority.shift()!;
      units = units.filter((x) => x !== u);
      dropped.push(topics.get(u.topicId)!.title);
    }
    if (dropped.length) {
      notes.push(
        `Tiden räcker inte till allt. Vi prioriterade det viktigaste och lät bli: ${dropped.join(", ")}. De tränas ändå i övningsproven.`,
      );
    }
  }

  const buckets: Unit[][] = learnDates.map(() => []);
  if (learnDates.length) {
    const per = Math.ceil(units.length / learnDates.length);
    units.forEach((u, i) => buckets[Math.min(learnDates.length - 1, Math.floor(i / Math.max(1, per)))].push(u));
  }

  // ---- spaced repetition bookkeeping ----------------------------------------------
  type ReviewState = { topicId: string; due: string; step: number };
  const reviews: ReviewState[] = [];
  for (const t of input.topics) {
    if (t.lessonDone || priorities.find((p) => p.topic_id === t.id)?.decision === "maintain") {
      const last = t.lastPracticedAt ? t.lastPracticedAt.slice(0, 10) : input.today;
      reviews.push({ topicId: t.id, due: addDays(last, REVIEW_INTERVALS[0]), step: 0 });
    }
  }
  const priorityOf = (id: string) => priorities.find((p) => p.topic_id === id)?.priority ?? 0;

  function takeDueReviews(date: string, max: number): string[] {
    const due = reviews
      .filter((r) => r.due <= date)
      .sort((a, b) => priorityOf(b.topicId) - priorityOf(a.topicId))
      .slice(0, max);
    for (const r of due) {
      r.step += 1;
      r.due = addDays(date, REVIEW_INTERVALS[Math.min(r.step, REVIEW_INTERVALS.length - 1)]);
    }
    return due.map((r) => r.topicId);
  }

  const sessions: PlannedSession[] = [];

  learnDates.forEach((date, idx) => {
    const bucket = buckets[idx];
    const items: SessionItemInput[] = [];
    let minutes = 0;

    if (bucket.length === 0) {
      // Pure repetition / mixed practice session.
      const maxTopics = Math.max(2, Math.floor(M / 5));
      let ids = takeDueReviews(date, maxTopics);
      if (ids.length === 0) {
        // Nothing due yet: practise the weakest important topics.
        ids = [...priorities]
          .filter((p) => p.decision !== "maintain")
          .slice(0, Math.min(maxTopics, 3))
          .map((p) => p.topic_id);
      }
      if (ids.length === 0) return;
      const per = Math.max(3, Math.floor(M / ids.length));
      for (const id of ids) {
        items.push({ id: newItemId(), kind: "review", topic_id: id, topic_ids: [id], minutes: per, label: `Repetera ${topics.get(id)!.title}` });
        minutes += per;
      }
      sessions.push({
        scheduled_date: date,
        kind: "review",
        title: "Repetition",
        goal: `Fräscha upp ${joinTitles(ids.map((id) => topics.get(id)!.title))} så att det sitter kvar till provet.`,
        estimated_minutes: Math.round(minutes),
        topic_ids: ids,
        items,
      });
      return;
    }

    const due = idx === 0 ? [] : takeDueReviews(date, M >= 30 ? 2 : 1);
    for (const id of due) {
      items.push({ id: newItemId(), kind: "review", topic_id: id, topic_ids: [id], minutes: 3, label: `Snabbrepetition: ${topics.get(id)!.title}` });
      minutes += 3;
    }

    for (const u of bucket) {
      const t = topics.get(u.topicId)!;
      if (u.part === 1) {
        items.push({ id: newItemId(), kind: "lesson", topic_id: t.id, topic_ids: [t.id], minutes: lessonMinutes(t), label: `Lektion: ${t.title}` });
        items.push({ id: newItemId(), kind: "practice", topic_id: t.id, topic_ids: [t.id], minutes: practiceMinutes(t), label: `Öva: ${t.title}` });
        reviews.push({ topicId: t.id, due: addDays(date, REVIEW_INTERVALS[0]), step: 0 });
      } else {
        items.push({ id: newItemId(), kind: "example", topic_id: t.id, topic_ids: [t.id], minutes: 4, label: `Lösta exempel: ${t.title}` });
        items.push({ id: newItemId(), kind: "practice", topic_id: t.id, topic_ids: [t.id], minutes: practiceMinutes(t) + 1, label: `Fördjupning: ${t.title}`, focus: "Svårare tillämpning och flerstegsuppgifter" });
      }
      minutes += unitMinutes(u, t);
    }

    const main = bucket.map((u) => topics.get(u.topicId)!);
    const first = bucket[0];
    const title =
      bucket.length === 1
        ? `${first.part === 1 ? "Förstå" : "Fördjupa"} ${lowerFirst(main[0].title)}`
        : main.map((t) => t.title).join(" + ");
    sessions.push({
      scheduled_date: date,
      kind: "learn",
      title,
      goal:
        first.part === 1
          ? `Förstå ${joinTitles(main.map((t) => lowerFirst(t.title)))} och kunna använda det i uppgifter.`
          : `Klara svårare uppgifter om ${joinTitles(main.map((t) => lowerFirst(t.title)))}.`,
      estimated_minutes: Math.round(minutes),
      topic_ids: [...new Set([...due, ...bucket.map((u) => u.topicId)])],
      items,
    });
  });

  // ---- the two final sessions -------------------------------------------------------
  const allTopicIds = priorities.map((p) => p.topic_id);
  tail.forEach((kind, i) => {
    const date = tailDates[i];
    if (kind === "mock1") {
      const minutes = clampInt(M + 10, 20, 45);
      sessions.push({
        scheduled_date: date,
        kind,
        title: "Övningsprov",
        goal: "Gör ett riktigt övningsprov utan hjälp, precis som på provet.",
        estimated_minutes: minutes,
        topic_ids: allTopicIds,
        items: [{ id: newItemId(), kind: "mock_exam", topic_id: null, topic_ids: allTopicIds, minutes, label: "Övningsprov 1" }],
      });
    } else {
      const minutes = clampInt(M + 20, 25, 60);
      sessions.push({
        scheduled_date: date,
        kind,
        title: "Träna svagheter + slutprov",
        goal: "Träna på det som höll dig tillbaka i övningsprovet och gör sedan slutprovet.",
        estimated_minutes: minutes,
        topic_ids: allTopicIds,
        // Remediation items are filled in after Mock Exam 1 has been assessed.
        items: [{ id: newItemId(), kind: "final_exam", topic_id: null, topic_ids: allTopicIds, minutes: clampInt(M, 15, 40), label: "Slutprov" }],
      });
    }
  });

  return { sessions, priorities, dropped, notes };
}

function joinTitles(titles: string[]) {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} och ${titles[titles.length - 1]}`;
}

function lowerFirst(s: string) {
  // Keep acronyms / proper nouns ("pH", "EU", "Newton") intact.
  if (s.length > 1 && s[1] === s[1].toUpperCase() && /[A-ZÅÄÖ]/.test(s[1])) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}
function clampInt(x: number, min: number, max: number) {
  return Math.round(Math.min(max, Math.max(min, x)));
}
function round(x: number) {
  return Math.round(x * 1000) / 1000;
}
