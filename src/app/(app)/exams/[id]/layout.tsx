import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { daysBetween, longDate, todayISO } from "@/lib/engine/dates";
import { requireUser } from "@/lib/supabase/server";
import { ExamTabs } from "./tabs";

export default async function ExamLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: project } = await supabase.from("study_projects").select("id, title, subject, exam_date").eq("id", id).maybeSingle();
  if (!project) notFound();
  const days = daysBetween(todayISO(), project.exam_date);
  return (
    <>
      <Link href="/exams" className="-ml-1 mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Mina prov
      </Link>
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">{project.subject}</p>
        <h1 className="mt-1 text-title font-bold text-ink sm:text-display">{project.title}</h1>
        <p className="mt-2 text-muted">
          {longDate(project.exam_date)} · {days < 0 ? "Provet har varit" : days === 0 ? "Idag" : `${days} dagar kvar`}
        </p>
      </header>
      <ExamTabs id={project.id} />
      {children}
    </>
  );
}
