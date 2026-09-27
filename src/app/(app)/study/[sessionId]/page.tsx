import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseItems } from "@/lib/domain/session";
import { requireUser } from "@/lib/supabase/server";
import { SessionRunner } from "./session-runner";

export const metadata: Metadata = { title: "Pass" };

export default async function StudyPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { supabase } = await requireUser();
  const { data: session } = await supabase.from("study_sessions").select("*, study_projects(id, title, exam_date)").eq("id", sessionId).maybeSingle();
  if (!session) notFound();
  const project = session.study_projects as { id: string; title: string; exam_date: string };
  const { data: next } = await supabase
    .from("study_sessions")
    .select("id, title, scheduled_date")
    .eq("plan_id", session.plan_id)
    .eq("status", "pending")
    .neq("id", session.id)
    .order("position")
    .limit(1)
    .maybeSingle();
  return (
    <SessionRunner
      session={{
        id: session.id,
        title: session.title,
        goal: session.goal,
        kind: session.kind,
        status: session.status,
        estimated_minutes: session.estimated_minutes,
        items: parseItems(session.items),
      }}
      project={{ id: project.id, title: project.title }}
      nextSession={next}
    />
  );
}
