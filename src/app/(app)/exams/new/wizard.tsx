"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Info, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FileDrop, type PendingFile } from "@/components/materials/file-drop";
import { useUploader } from "@/components/materials/use-uploader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { addDays, daysBetween, isoWeekday, todayISO, WEEKDAYS } from "@/lib/engine/dates";
import { getSubjectProfile, SUBJECT_OPTIONS } from "@/lib/domain/subjects";
import { cn } from "@/lib/utils";
import { addTextMaterial, createProject } from "../actions";

const MINUTES = [15, 20, 30, 45];
const GRADES = ["E", "D", "C", "B", "A"] as const;
const TITLE_EXAMPLES: Record<string, string[]> = {
  Matematik: ["Ekvationer", "Procent och bråk", "Geometri"],
  Geografi: ["Klimat och väder", "Befolkning", "Växthuseffekten"],
  Historia: ["Industriella revolutionen", "Första världskriget"],
  Biologi: ["Ekologi", "Cellen", "Kroppen"],
  Fysik: ["Elektricitet", "Kraft och rörelse"],
  Kemi: ["Syror och baser", "Atomer"],
  Samhällskunskap: ["Demokrati", "Ekonomi"],
  Svenska: ["Novellanalys", "Argumenterande text"],
  Engelska: ["Reading comprehension", "Grammar test"],
};

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const TOTAL = 6;

export function NewExamWizard() {
  const router = useRouter();
  const { uploadFile } = useUploader();
  const today = todayISO();

  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState(1);
  const [subject, setSubject] = useState("");
  const [otherSubject, setOtherSubject] = useState("");
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [customMinutes, setCustomMinutes] = useState(false);
  const [grade, setGrade] = useState<(typeof GRADES)[number] | null>(null);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [pasted, setPasted] = useState("");
  const [teacherSaid, setTeacherSaid] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finalSubject = subject === "Annat" ? otherSubject.trim() : subject;
  const [loadingDemo, setLoadingDemo] = useState(false);

  /** Loads the bundled demo material (public/demo) as if the student had picked the files. */
  const loadDemo = async () => {
    setLoadingDemo(true);
    setError(null);
    try {
      const math = finalSubject === "Matematik";
      const dir = math ? "matematik-ekvationer" : "geografi-ak8";
      const docs: Array<[string, PendingFile["category"]]> = math
        ? [
            ["planering-ekvationer.md", "planning"],
            ["bedomning-ekvationer.md", "criteria"],
          ]
        : [
            ["planering-klimatet.md", "planning"],
            ["betygskriterier-klimatet.md", "criteria"],
            ["genomgang-anteckningar.txt", "notes"],
          ];
      const loaded: PendingFile[] = [];
      for (const [name, category] of docs) {
        const res = await fetch(`/demo/${dir}/${name}`);
        if (!res.ok) throw new Error("Kunde inte hämta exempelunderlaget.");
        const blob = await res.blob();
        loaded.push({ file: new File([blob], name, { type: name.endsWith(".md") ? "text/markdown" : "text/plain" }), category, key: `demo-${name}` });
      }
      const said = await fetch(`/demo/${dir}/lararen-sa.txt`);
      if (said.ok) setTeacherSaid(await said.text());
      setFiles((f) => [...f.filter((x) => !x.key.startsWith("demo-")), ...loaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte hämta exempelunderlaget.");
    } finally {
      setLoadingDemo(false);
    }
  };
  const daysLeft = examDate ? daysBetween(today, examDate) : null;
  const sessionsBeforeExam = useMemo(() => {
    if (!examDate || daysLeft === null || daysLeft <= 0) return 0;
    let n = 0;
    for (let i = 0; i < daysLeft; i++) if (days.includes(isoWeekday(addDays(today, i)))) n++;
    return n;
  }, [examDate, daysLeft, days, today]);

  const canContinue = [
    finalSubject.length > 0,
    title.trim().length > 0,
    Boolean(examDate) && examDate >= today,
    minutes >= 5 && minutes <= 180,
    days.length > 0,
    true,
  ][step];

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setError(null);
    setStep(Math.max(0, Math.min(TOTAL - 1, to)) as Step);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      setStatus("Skapar provet…");
      const created = await createProject({
        subject: finalSubject,
        title: title.trim(),
        exam_date: examDate,
        minutes_per_session: minutes,
        available_days: [...days].sort(),
        target_grade: grade,
      });
      if (!created.id) throw new Error(created.error ?? "Kunde inte skapa provet.");
      const projectId = created.id;

      const problems: string[] = [];
      for (const [i, f] of files.entries()) {
        setStatus(`Laddar upp ${i + 1} av ${files.length}: ${f.file.name}`);
        try {
          await uploadFile(projectId, f.file, f.category);
        } catch (e) {
          problems.push(e instanceof Error ? e.message : f.file.name);
        }
      }
      if (pasted.trim()) {
        const r = await addTextMaterial({ projectId, kind: "paste", text: pasted, category: "notes" });
        if (r.error) problems.push(r.error);
      }
      if (teacherSaid.trim()) {
        const r = await addTextMaterial({ projectId, kind: "teacher_note", text: teacherSaid, category: "teacher_said" });
        if (r.error) problems.push(r.error);
      }
      // Extraction starts on the materials page, which shows live status per file.
      router.push(`/exams/${projectId}/materials${problems.length ? `?upload_errors=${encodeURIComponent(problems.join("\n"))}` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel.");
      setSubmitting(false);
      setStatus(null);
    }
  };

  const steps = [
    {
      title: "Vad är det för ämne?",
      body: (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUBJECT_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSubject(s);
                  if (s !== "Annat") go(1);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-4 text-left text-base font-semibold transition-all",
                  subject === s ? "border-white/50 bg-white/[0.14]" : "border-white/10 bg-white/[0.05] hover:bg-white/[0.09]",
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {s === "Annat" ? "✏️" : getSubjectProfile(s).emoji}
                </span>
                {s}
              </button>
            ))}
          </div>
          {subject === "Annat" && (
            <div>
              <Label htmlFor="other">Vilket ämne?</Label>
              <Input id="other" autoFocus value={otherSubject} onChange={(e) => setOtherSubject(e.target.value)} placeholder="T.ex. Teknik" maxLength={80} />
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Vad heter provet?",
      body: (
        <div className="flex flex-col gap-4">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="T.ex. Klimatprovet" maxLength={160} className="h-14 text-lg" onKeyDown={(e) => e.key === "Enter" && title.trim() && go(2)} />
          <div className="flex flex-wrap gap-2">
            {(TITLE_EXAMPLES[finalSubject] ?? []).map((ex) => (
              <button key={ex} type="button" onClick={() => setTitle(ex)} className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-sm font-medium text-muted hover:border-ink hover:text-ink">
                {ex}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "När är provet?",
      body: (
        <div className="flex flex-col gap-4">
          <Input type="date" autoFocus min={today} value={examDate} onChange={(e) => setExamDate(e.target.value)} className="h-14 text-lg" aria-label="Provdatum" />
          <div className="flex flex-wrap gap-2">
            {[3, 7, 14, 21].map((d) => (
              <button key={d} type="button" onClick={() => setExamDate(addDays(today, d))} className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-sm font-medium text-muted hover:border-ink hover:text-ink">
                Om {d === 7 ? "en vecka" : d === 14 ? "två veckor" : d === 21 ? "tre veckor" : `${d} dagar`}
              </button>
            ))}
          </div>
          {daysLeft !== null && daysLeft >= 0 && (
            <p className="text-muted">{daysLeft === 0 ? "Provet är idag – vi gör det bästa av tiden." : `${daysLeft} dagar kvar.`}</p>
          )}
        </div>
      ),
    },
    {
      title: "Hur mycket vill du plugga?",
      body: (
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-3 text-muted">Per pass</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMinutes(m);
                    setCustomMinutes(false);
                  }}
                  className={cn("rounded-lg border py-4 text-lg font-bold transition-all", !customMinutes && minutes === m ? "border-white/50 bg-white/[0.14]" : "border-white/10 bg-white/[0.05] hover:bg-white/[0.09]")}
                >
                  {m} min
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomMinutes(true)}
                className={cn("rounded-lg border py-4 text-base font-bold transition-all", customMinutes ? "border-white/50 bg-white/[0.14]" : "border-white/10 bg-white/[0.05] hover:bg-white/[0.09]")}
              >
                Egen tid
              </button>
            </div>
            {customMinutes && (
              <div className="mt-3 flex items-center gap-3">
                <Input type="number" min={5} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-28" aria-label="Minuter per pass" autoFocus />
                <span className="text-muted">minuter</span>
              </div>
            )}
          </div>
          <div>
            <p className="mb-3 text-muted">Vilket betyg siktar du på? (valfritt)</p>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <button key={g} type="button" onClick={() => setGrade(grade === g ? null : g)} className={cn("size-12 rounded-full border text-base font-bold", grade === g ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.05] text-ink hover:bg-white/[0.09]")}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Vilka dagar kan du plugga?",
      body: (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays(on ? days.filter((x) => x !== d.value) : [...days, d.value])}
                  className={cn("rounded-lg border py-4 text-sm font-bold transition-all", on ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.05] text-muted hover:bg-white/[0.09]")}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
          {examDate && (
            <p className="text-muted">
              {sessionsBeforeExam > 0 ? `Det blir ${sessionsBeforeExam} pass à ${minutes} min innan provet.` : "Inga pluggdagar hinns med innan provet – vi lägger till de dagar som finns."}
            </p>
          )}
        </div>
      ),
    },
    {
      title: "Ladda upp underlag",
      body: (
        <div className="flex flex-col gap-6">
          <Alert tone="info">Ju mer av lärarens riktiga underlag du lägger in, desto bättre kan studieplanen anpassas.</Alert>
          <FileDrop files={files} onChange={setFiles} />
          <div>
            <Label htmlFor="pasted">Klistra in text</Label>
            <Textarea id="pasted" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="T.ex. planeringen från lärplattformen" />
          </div>
          <div>
            <Label htmlFor="teacher">Det här har läraren sagt kommer på provet</Label>
            <Textarea id="teacher" value={teacherSaid} onChange={(e) => setTeacherSaid(e.target.value)} placeholder="T.ex. ”Ni ska kunna förklara skillnaden mellan väder och klimat”" className="min-h-24" />
          </div>
          {files.length === 0 && !pasted.trim() && !teacherSaid.trim() && (
            <div className="flex flex-col gap-3 rounded-lg bg-white/[0.06] p-4">
              <p className="flex items-start gap-2 text-sm text-muted">
                <Info className="mt-0.5 size-4 shrink-0" /> Du kan lägga till underlag senare, men analysen behöver minst ett material.
              </p>
              <Button variant="secondary" size="sm" className="self-start" onClick={loadDemo} loading={loadingDemo}>
                Prova med exempelunderlag ({finalSubject === "Matematik" ? "Matematik: ekvationer" : "Geografi åk 8: klimatet"})
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => (step === 0 ? router.push("/dashboard") : go(step - 1))} aria-label="Tillbaka" disabled={submitting}>
          <ArrowLeft />
        </Button>
        <ProgressBar value={(step + 1) / TOTAL} size="sm" aria-label={`Steg ${step + 1} av ${TOTAL}`} />
        <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
          {step + 1}/{TOTAL}
        </span>
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: dir * 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -32 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="mb-8 text-title font-bold text-ink sm:text-display">{steps[step].title}</h1>
          {steps[step].body}
        </motion.div>
      </AnimatePresence>

      {error && (
        <Alert tone="error" className="mt-6">
          {error}
        </Alert>
      )}

      <div className="sticky bottom-24 mt-10 lg:bottom-6">
        {step < TOTAL - 1 ? (
          <Button size="lg" block onClick={() => go(step + 1)} disabled={!canContinue}>
            Fortsätt <ArrowRight />
          </Button>
        ) : (
          <Button size="lg" block variant="brand" onClick={submit} loading={submitting}>
            {!submitting && <Sparkles />} {status ?? "Skapa mitt prov"}
          </Button>
        )}
      </div>
    </div>
  );
}
