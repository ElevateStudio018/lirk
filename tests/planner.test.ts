import { describe, expect, it } from "vitest";
import { isoWeekday } from "@/lib/engine/dates";
import { planStudy, studyDates, topicPriorities, type PlannerTopic } from "@/lib/engine/planner";

const T = (id: string, over: Partial<PlannerTopic> = {}): PlannerTopic => ({
  id,
  title: id.toUpperCase(),
  importance: 3,
  difficulty: 2,
  mastery: 0.4,
  confidence: 0.5,
  prerequisiteIds: [],
  ...over,
});

// 2026-10-05 is a Monday.
const base = { today: "2026-10-05", examDate: "2026-10-16", availableDays: [1, 2, 3, 4, 5], minutesPerSession: 20 };

describe("study plan engine", () => {
  it("uses only available weekdays before the exam day", () => {
    const d = studyDates("2026-10-05", "2026-10-16", [1, 3, 5]);
    expect(d.every((x) => [1, 3, 5].includes(isoWeekday(x)))).toBe(true);
    expect(d).not.toContain("2026-10-16");
  });

  it("prioritises important topics with a confident knowledge gap", () => {
    const p = topicPriorities([T("a", { importance: 5, mastery: 0.2, confidence: 0.8 }), T("b", { importance: 2, mastery: 0.8, confidence: 0.8 })]);
    expect(p[0].topic_id).toBe("a");
  });

  it("gives prerequisites extra weight and teaches them first", () => {
    const topics = [T("adv", { importance: 5, mastery: 0.2 }), T("pre", { importance: 2, mastery: 0.4 }), T("x", { importance: 5, mastery: 0.3, prerequisiteIds: ["pre"] })];
    topics[0].prerequisiteIds = ["pre"];
    const plan = planStudy({ ...base, topics });
    const lessonOrder = plan.sessions.flatMap((s) => s.items.filter((i) => i.kind === "lesson").map((i) => i.topic_id));
    expect(lessonOrder.indexOf("pre")).toBeLessThan(lessonOrder.indexOf("adv"));
    expect(lessonOrder.indexOf("pre")).toBeLessThan(lessonOrder.indexOf("x"));
  });

  it("the last two sessions are Mock Exam 1 and Remediation + Final Mock", () => {
    const plan = planStudy({ ...base, topics: [T("a"), T("b"), T("c")] });
    const kinds = plan.sessions.map((s) => s.kind);
    expect(kinds.at(-2)).toBe("mock1");
    expect(kinds.at(-1)).toBe("remediation_final");
    expect(plan.sessions.at(-1)!.items.some((i) => i.kind === "final_exam")).toBe(true);
  });

  it("schedules spaced repetition of earlier topics", () => {
    const plan = planStudy({ ...base, topics: [T("a"), T("b"), T("c"), T("d")] });
    const reviews = plan.sessions.flatMap((s) => s.items.filter((i) => i.kind === "review"));
    expect(reviews.length).toBeGreaterThan(0);
  });

  it("known topics are only maintained, not re-taught", () => {
    const plan = planStudy({ ...base, topics: [T("known", { mastery: 0.95, confidence: 0.8 }), T("weak", { mastery: 0.2, confidence: 0.6 })] });
    const lessons = plan.sessions.flatMap((s) => s.items.filter((i) => i.kind === "lesson").map((i) => i.topic_id));
    expect(lessons).toContain("weak");
    expect(lessons).not.toContain("known");
  });

  it("drops the least important topics when time is short, and says so", () => {
    const topics = Array.from({ length: 12 }, (_, i) => T(`t${i}`, { importance: (i % 5) + 1, difficulty: 3 }));
    const plan = planStudy({ ...base, examDate: "2026-10-09", minutesPerSession: 15, topics });
    expect(plan.dropped.length).toBeGreaterThan(0);
    expect(plan.notes.join(" ")).toMatch(/Tiden räcker inte/);
  });

  it("handles an exam tomorrow without crashing", () => {
    const plan = planStudy({ ...base, examDate: "2026-10-06", topics: [T("a")] });
    expect(plan.sessions.length).toBeGreaterThan(0);
    expect(plan.sessions.some((s) => s.kind === "mock1")).toBe(true);
  });

  it("session minutes stay close to the student's choice", () => {
    const plan = planStudy({ ...base, minutesPerSession: 30, topics: [T("a"), T("b"), T("c"), T("d"), T("e")] });
    for (const s of plan.sessions.filter((x) => x.kind === "learn")) expect(s.estimated_minutes).toBeLessThanOrEqual(30 * 1.5);
  });

  it("is deterministic apart from generated item ids", () => {
    const topics = [T("a"), T("b"), T("c")];
    const strip = (p: ReturnType<typeof planStudy>) => p.sessions.map((s) => ({ ...s, items: s.items.map(({ id: _id, ...rest }) => rest) }));
    expect(strip(planStudy({ ...base, topics }))).toEqual(strip(planStudy({ ...base, topics })));
  });
});
