/**
 * End-to-end: the complete V1 study loop through the real service layer, a
 * real PostgreSQL database with the production migrations and RLS (via
 * PostgREST, as on Supabase) and the real demo teacher material.
 * Only the LLM is replaced by fixtures (see fake-llm.ts).
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { calls, fakeGenerateStructured } from "./fake-llm";
import { clientFor, createUser, startRestProxy, withPg } from "./harness";

vi.mock("@/lib/ai/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/client")>();
  return { ...original, generateStructured: fakeGenerateStructured, isAIConfigured: () => true };
});

const { processMaterial } = await import("@/lib/services/materials");
const { generateKnowledgeMap } = await import("@/lib/services/knowledge-map");
const { ensureDiagnostic, getDiagnosticForStudent, answerDiagnostic, completeDiagnostic } = await import("@/lib/services/diagnostic");
const { generatePlan, getActivePlan } = await import("@/lib/services/plan");
const { prepareCurrentItem, completeItem, getSession } = await import("@/lib/services/sessions");
const { getLessonView, answerCheckpoint } = await import("@/lib/services/lessons");
const { getExerciseSetView, answerExercise } = await import("@/lib/services/exercises");
const { ensureMockExam, getMockExamView, startAttempt, saveAnswers, submitAttempt } = await import("@/lib/services/mock-exams");
const { assessAttempt } = await import("@/lib/services/assessment");
const { getFinalReport } = await import("@/lib/services/report");
const { getProjectOverview } = await import("@/lib/services/overview");
const { getProject, getTopics } = await import("@/lib/services/projects");
const { parseItems } = await import("@/lib/domain/session");
const { addDays, todayISO } = await import("@/lib/engine/dates");

type DB = Awaited<ReturnType<typeof clientFor>>;

const demo = (dir: string, file: string) => readFileSync(`public/demo/${dir}/${file}`, "utf8");

let proxy: Awaited<ReturnType<typeof startRestProxy>>;
beforeAll(async () => {
  proxy = await startRestProxy();
});
afterAll(() => proxy?.close());

async function createProjectWithMaterials(db: DB, subject: string, title: string, dir: string, files: Array<[string, string, "paste" | "teacher_note"]>) {
  const { data: project, error } = await db
    .from("study_projects")
    .insert({ subject, title, exam_date: addDays(todayISO(), 12), minutes_per_session: 30, available_days: [1, 2, 3, 4, 5, 6, 7] })
    .select()
    .single();
  if (error) throw error;
  for (const [file, category, type] of files) {
    const { data: m, error: mErr } = await db
      .from("source_materials")
      .insert({ project_id: project.id, type, category, filename: file, extracted_text: demo(dir, file), processing_status: "uploaded" })
      .select("id")
      .single();
    if (mErr) throw mErr;
    const processed = await processMaterial(db, m.id);
    expect(processed.processing_status).toBe("ready");
    expect(processed.normalized_text!.length).toBeGreaterThan(50);
  }
  return project;
}

/** Answers every pending item of a session (lessons watched, exercises answered by `choose`). */
async function runSession(db: DB, sessionId: string, choose: (topicId: string | null, i: number) => number, stopAfter?: number) {
  const decisions: string[] = [];
  for (let step = 0; step < 60; step++) {
    const { item, decision } = await prepareCurrentItem(db, sessionId);
    if (decision) decisions.push(decision.action);
    if (!item) return decisions;
    if (item.kind === "mock_exam" || item.kind === "final_exam") return decisions;
    if (["lesson", "micro_lesson", "example"].includes(item.kind)) {
      const lesson = await getLessonView(db, item.ref_id!);
      expect(lesson.scenes.length).toBeGreaterThan(0);
    } else {
      const set = await getExerciseSetView(db, item.ref_id!);
      for (const [i, q] of set.questions.entries()) {
        await answerExercise(db, item.ref_id!, q.question.id, { kind: "choice", choice: choose(item.topic_id, i) });
      }
    }
    const res = await completeItem(db, sessionId, item.id);
    if (res.decision) decisions.push(res.decision.action);
    if (res.sessionCompleted) return decisions;
    if (stopAfter !== undefined && step + 1 >= stopAfter) return decisions;
  }
  throw new Error("session did not finish");
}

describe("Geografi åk 8 – växthuseffekt och klimatförändringar (full loop)", () => {
  let userA: string;
  let dbA: DB;
  let projectId: string;

  it("creates the exam and processes the teacher's material (UPLOAD → STORE → EXTRACT → NORMALIZE)", async () => {
    userA = await createUser("elev-a@example.com");
    dbA = clientFor(proxy.url, userA);
    const project = await createProjectWithMaterials(dbA, "Geografi", "Klimatprovet", "geografi-ak8", [
      ["planering-klimatet.md", "planning", "paste"],
      ["betygskriterier-klimatet.md", "criteria", "paste"],
      ["genomgang-anteckningar.txt", "notes", "paste"],
      ["lararen-sa.txt", "teacher_said", "teacher_note"],
    ]);
    projectId = project.id;
  });

  it("ANALYZE: builds a knowledge map where every claim is traceable – hallucinated quotes are downgraded", async () => {
    const res = await generateKnowledgeMap(dbA, projectId);
    expect(res.topics).toBe(8);
    const project = await getProject(dbA, projectId);
    expect(project.status).toBe("map_ready");
    expect(project.has_grading_criteria).toBe(true);
    const topics = await getTopics(dbA, projectId);
    const albedo = topics.find((t) => t.key === "albedo")!;
    expect(albedo.evidence_type).toBe("explicit");
    expect((albedo.evidence as Array<{ verified: boolean }>)[0].verified).toBe(true);
    expect(albedo.prerequisite_ids).toEqual([topics.find((t) => t.key === "vaxthuseffekten")!.id]);
    const diagram = topics.find((t) => t.key === "diagram")!;
    expect(diagram.evidence_type).toBe("inferred");
    expect(diagram.inference_reason).toMatch(/kunde inte hittas ordagrant/);
  });

  it("diagnostic: 8–15 questions, no answer keys to the browser, summary instead of statistics", async () => {
    await ensureDiagnostic(dbA, projectId);
    const qs = await getDiagnosticForStudent(dbA, projectId);
    expect(qs.length).toBeGreaterThanOrEqual(8);
    expect(qs.length).toBeLessThanOrEqual(15);
    expect(JSON.stringify(qs)).not.toMatch(/correct_index|key_points|misconception/);

    const topics = await getTopics(dbA, projectId);
    const keyOf = (topicId: string) => topics.find((t) => t.id === topicId)!.key;
    for (const q of qs) {
      const key = keyOf(q.topic_id);
      const strong = key === "vader_klimat" || key === "vaxthusgaser";
      if (q.question.type === "mcq") await answerDiagnostic(dbA, projectId, q.id, { kind: "choice", choice: strong ? 0 : 1 });
      else await answerDiagnostic(dbA, projectId, q.id, strong ? { kind: "text", text: "RÄTT: orsak, mekanism och konsekvens" } : null);
    }
    const summary = await completeDiagnostic(dbA, projectId);
    expect(summary.strong).toEqual(expect.arrayContaining(["Väder och klimat", "Växthusgaser och källor"]));
    expect(summary.needsHelp.length + summary.unsure.length).toBeGreaterThan(0);
    const albedo = (await getTopics(dbA, projectId)).find((t) => t.key === "albedo")!;
    expect(albedo.mastery!).toBeLessThan(0.5);
    expect(albedo.performance_pattern).toBe("consistent_failure");
  });

  it("study plan: sessions until the exam, weakest-important first, mock 1 and remediation+final last", async () => {
    const res = await generatePlan(dbA, projectId);
    expect(res.sessions).toBeGreaterThan(3);
    const active = (await getActivePlan(dbA, projectId))!;
    const kinds = active.sessions.map((s) => s.kind);
    expect(kinds.at(-2)).toBe("mock1");
    expect(kinds.at(-1)).toBe("remediation_final");
    const topics = await getTopics(dbA, projectId);
    const firstLessons = parseItems(active.sessions[0].items).filter((i) => i.kind === "lesson").map((i) => topics.find((t) => t.id === i.topic_id)!.key);
    expect(firstLessons).not.toContain("vader_klimat"); // already known → maintained only
    expect((await getProject(dbA, projectId)).status).toBe("studying");
    const overview = await getProjectOverview(dbA, projectId);
    expect(overview.next.kind).toBe("session");
    expect(overview.readiness.coverage).toBeGreaterThan(0);
  });

  it("session: lesson with checkpoint → micro-lesson decision; exercises update mastery; adaptive engine inserts steps and logs why", async () => {
    const active = (await getActivePlan(dbA, projectId))!;
    const first = active.sessions[0];

    const { item } = await prepareCurrentItem(dbA, first.id);
    expect(item!.kind).toBe("lesson");
    const lesson = await getLessonView(dbA, item!.ref_id!);
    expect(JSON.stringify(lesson.checkpoints)).not.toContain("correct_index");
    const cp = await answerCheckpoint(dbA, item!.ref_id!, lesson.checkpoints[0].id, 2, 1);
    expect(cp).toMatchObject({ correct: false, decision: "insert_micro_lesson" });
    expect(cp.remedyScenes.length).toBeGreaterThan(0);

    // Wrong answers with a misconception on the first practice → MICRO_LESSON.
    const decisions = await runSession(dbA, first.id, () => 1, 2);
    const rest = await runSession(dbA, first.id, () => 0);
    const all = [...decisions, ...rest];
    expect(all).toContain("MICRO_LESSON");

    const session = await getSession(dbA, first.id);
    expect(session.status).toBe("completed");
    const items = parseItems(session.items);
    expect(items.some((i) => i.origin === "adaptive" && i.kind === "micro_lesson")).toBe(true);
    const { data: log } = await dbA.from("adaptive_decisions").select("action, rule, reason, inputs").eq("session_id", first.id);
    expect(log!.length).toBeGreaterThan(0);
    expect(log!.every((d) => d.reason.length > 10 && d.rule)).toBe(true);

    // The plan was re-planned from the new mastery after the session.
    expect((await getActivePlan(dbA, projectId))!.plan.version).toBeGreaterThan(1);
  });

  it("mock exam 1: no feedback, locked after submission, assessed separately with remediation targets", async () => {
    const examId = await ensureMockExam(dbA, projectId, "mock1");
    const view = await getMockExamView(dbA, examId);
    expect(JSON.stringify(view.questions)).not.toMatch(/key_points|correct_index|rubric/);
    const attempt = await startAttempt(dbA, examId);
    const answers = Object.fromEntries(
      view.questions.map((q) => [q.id, q.question.type === "mcq" ? { kind: "choice" as const, choice: 1 } : { kind: "text" as const, text: "DELVIS" }]),
    );
    await saveAnswers(dbA, attempt.id, answers);
    await submitAttempt(dbA, attempt.id, {});
    await expect(saveAnswers(dbA, attempt.id, answers)).rejects.toMatchObject({ status: 409 });
    const { error } = await dbA.from("exam_attempts").update({ answers: {} }).eq("id", attempt.id);
    expect(error?.message).toMatch(/locked/);

    await assessAttempt(dbA, attempt.id);
    const { data: result } = await dbA.from("assessment_results").select("*").eq("attempt_id", attempt.id).single();
    expect(result!.total_score).toBeLessThan(result!.max_score);
    expect((result!.overall as { criteria_statement: string }).criteria_statement).not.toMatch(/du kommer få/i);
    expect((await getProject(dbA, projectId)).status).toBe("mock1_done");

    const { data: targets } = await dbA.from("remediation_targets").select("*").eq("assessment_id", result!.id);
    expect(targets!.length).toBeGreaterThanOrEqual(3);
    expect(targets!.every((t) => t.topic_id)).toBe(true);

    const remediation = (await getActivePlan(dbA, projectId))!.sessions.find((s) => s.kind === "remediation_final")!;
    const kinds = parseItems(remediation.items).map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(["micro_lesson", "example", "practice", "harder", "confirmation"]));
    expect(kinds.at(-1)).toBe("final_exam");
  });

  it("remediation → final mock with new questions → Mock 1 vs Final comparison", async () => {
    const remediation = (await getActivePlan(dbA, projectId))!.sessions.find((s) => s.kind === "remediation_final")!;
    await runSession(dbA, remediation.id, () => 0);

    const { data: targets } = await dbA.from("remediation_targets").select("status").eq("project_id", projectId);
    expect(targets!.some((t) => t.status === "resolved")).toBe(true);

    const { item } = await prepareCurrentItem(dbA, remediation.id);
    expect(item!.kind).toBe("final_exam");
    const finalId = item!.ref_id!;
    const mock1 = await getMockExamView(dbA, await ensureMockExam(dbA, projectId, "mock1"));
    const final = await getMockExamView(dbA, finalId);
    const mock1Prompts = new Set(mock1.questions.map((q) => q.question.prompt));
    expect(final.questions.every((q) => !mock1Prompts.has(q.question.prompt))).toBe(true);

    const attempt = await startAttempt(dbA, finalId);
    await submitAttempt(
      dbA,
      attempt.id,
      Object.fromEntries(final.questions.map((q) => [q.id, q.question.type === "mcq" ? { kind: "choice", choice: 0 } : { kind: "text", text: "RÄTT" }])),
    );
    await assessAttempt(dbA, attempt.id);
    expect((await getProject(dbA, projectId)).status).toBe("final_done");
    expect((await getSession(dbA, remediation.id)).status).toBe("completed");

    const report = await getFinalReport(dbA, projectId);
    expect(report!.totalAfter).toBeGreaterThan(report!.totalBefore);
    expect(report!.improved.length).toBeGreaterThan(0);
    expect(report!.lastMinute.length).toBeGreaterThan(0);
  });

  it("RLS: another student can see none of it – not even through the services", async () => {
    const userB = await createUser("elev-b@example.com");
    const dbB = clientFor(proxy.url, userB);
    await expect(getProject(dbB, projectId)).rejects.toMatchObject({ status: 404 });
    for (const table of ["study_projects", "source_materials", "knowledge_topics", "question_attempts", "study_sessions", "lesson_modules", "mock_exams", "exam_attempts", "assessment_results", "adaptive_decisions"] as const) {
      const { data } = await dbB.from(table).select("id");
      expect(data, table).toEqual([]);
    }
    const { error } = await dbB.from("source_materials").insert({ project_id: projectId, type: "paste", extracted_text: "injected" });
    expect(error).not.toBeNull();
    const counts = await withPg(async (c) => (await c.query("select count(*)::int as n from public.source_materials where project_id = $1", [projectId])).rows[0].n);
    expect(counts).toBe(4);
  });
});

describe("Matematik – ekvationer (same architecture, different subject)", () => {
  it("runs analysis, diagnostic, plan, a lesson and a mock exam with math-specific assessment style", async () => {
    const user = await createUser();
    const db = clientFor(proxy.url, user);
    const project = await createProjectWithMaterials(db, "Matematik", "Ekvationsprovet", "matematik-ekvationer", [
      ["planering-ekvationer.md", "planning", "paste"],
      ["bedomning-ekvationer.md", "criteria", "paste"],
      ["lararen-sa.txt", "teacher_said", "teacher_note"],
    ]);
    await generateKnowledgeMap(db, project.id);
    const topics = await getTopics(db, project.id);
    expect(topics.find((t) => t.key === "parenteser")!.prerequisite_ids.length).toBe(2);
    expect(topics.find((t) => t.key === "prioritering")!.evidence_type).toBe("inferred");

    await ensureDiagnostic(db, project.id);
    for (const q of await getDiagnosticForStudent(db, project.id)) {
      await answerDiagnostic(db, project.id, q.id, q.question.type === "mcq" ? { kind: "choice", choice: 0 } : { kind: "text", text: "DELVIS" });
    }
    await completeDiagnostic(db, project.id);
    await generatePlan(db, project.id);
    const plan = (await getActivePlan(db, project.id))!;
    const firstLessonTopic = parseItems(plan.sessions[0].items).find((i) => i.kind === "lesson")!.topic_id;
    // Prerequisites are taught before what builds on them.
    const order = plan.sessions.flatMap((s) => parseItems(s.items).filter((i) => i.kind === "lesson").map((i) => topics.find((t) => t.id === i.topic_id)!.key));
    if (order.includes("tva_steg") && order.includes("parenteser")) expect(order.indexOf("tva_steg")).toBeLessThan(order.indexOf("parenteser"));
    expect(firstLessonTopic).toBeTruthy();

    const { item } = await prepareCurrentItem(db, plan.sessions[0].id);
    const lesson = await getLessonView(db, item!.ref_id!);
    expect(lesson.scenes.some((s) => s.type === "equation")).toBe(true);

    await ensureMockExam(db, project.id, "mock1");
    const mockCall = calls.filter((c) => c.name === "mock_exam").at(-1)!;
    expect(mockCall.system).toMatch(/Matematikprov/);
    const exerciseCalls = calls.filter((c) => c.name === "lesson" && /Matematik/.test(c.system));
    expect(exerciseCalls.length).toBeGreaterThan(0);
  });
});
