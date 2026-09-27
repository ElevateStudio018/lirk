"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Eye, FileText, ImageIcon, Loader2, MessageSquareQuote, RotateCcw, Sparkles, Trash2, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FileDrop, type PendingFile } from "@/components/materials/file-drop";
import { CATEGORY_OPTIONS, useUploader } from "@/components/materials/use-uploader";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label, Textarea } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { Sheet } from "@/components/ui/sheet";
import { errorMessage, postJSON } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { addTextMaterial, deleteMaterial, updateMaterialCategory } from "../../actions";

type Material = {
  id: string;
  type: string;
  category: string;
  filename: string | null;
  processing_status: string;
  error_message: string | null;
  preview: string | null;
  chars: number;
  page_count: number | null;
  extraction_method: string | null;
};

const STATUS = {
  uploaded: { label: "Väntar", tone: "neutral" as const },
  processing: { label: "Läser…", tone: "info" as const },
  ready: { label: "Klar", tone: "good" as const },
  failed: { label: "Gick inte att läsa", tone: "bad" as const },
};

const METHOD: Record<string, string> = {
  "pdf-text": "Text ur PDF",
  plain: "Textfil",
  vision: "Avläst från bild med AI",
  "user-input": "Inskriven text",
};

function MaterialIcon({ type }: { type: string }) {
  if (type === "image") return <ImageIcon className="size-5" />;
  if (type === "teacher_note") return <MessageSquareQuote className="size-5" />;
  if (type === "paste" || type === "text") return <Type className="size-5" />;
  return <FileText className="size-5" />;
}

export function MaterialsManager({
  projectId,
  projectStatus,
  materials,
  uploadErrors,
}: {
  projectId: string;
  projectStatus: string;
  materials: Material[];
  uploadErrors: string[];
}) {
  const router = useRouter();
  const { uploadFile, processMaterial } = useUploader();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [pasted, setPasted] = useState("");
  const [teacherSaid, setTeacherSaid] = useState("");
  const [adding, setAdding] = useState(false);
  const [errors, setErrors] = useState<string[]>(uploadErrors);
  const [analyzing, setAnalyzing] = useState(false);
  const analysisRunningElsewhere = projectStatus === "analyzing" && !analyzing;
  const [analyzeError, setAnalyzeError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [preview, setPreview] = useState<Material | null>(null);
  const [, startTransition] = useTransition();
  const started = useRef(new Set<string>());

  const locked = !["collecting", "analyzing", "map_ready"].includes(projectStatus);
  const busy = materials.some((m) => m.processing_status === "uploaded" || m.processing_status === "processing");
  const ready = materials.filter((m) => m.processing_status === "ready").length;

  // EXTRACT + NORMALIZE for everything that has only been uploaded.
  useEffect(() => {
    for (const m of materials) {
      if (m.processing_status === "uploaded" && !started.current.has(m.id)) {
        started.current.add(m.id);
        processMaterial(m.id)
          .catch((e) => setErrors((x) => [...x, `${m.filename ?? "Material"}: ${errorMessage(e)}`]))
          .finally(() => router.refresh());
      }
    }
  }, [materials, processMaterial, router]);

  // Live status while something is being read (or an analysis started in another tab is running).
  useEffect(() => {
    if (!busy && !analysisRunningElsewhere) return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [busy, analysisRunningElsewhere, router]);

  const addMaterials = async () => {
    setAdding(true);
    const problems: string[] = [];
    for (const f of files) {
      try {
        await uploadFile(projectId, f.file, f.category);
      } catch (e) {
        problems.push(errorMessage(e));
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
    setErrors(problems);
    setFiles([]);
    setPasted("");
    setTeacherSaid("");
    setAdding(false);
    router.refresh();
  };

  const retry = async (m: Material) => {
    started.current.add(m.id);
    try {
      await processMaterial(m.id);
    } catch (e) {
      setErrors([`${m.filename ?? "Material"}: ${errorMessage(e)}`]);
    }
    router.refresh();
  };

  const analyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      await postJSON(`/api/projects/${projectId}/knowledge-map`);
      router.push(`/exams/${projectId}/map`);
    } catch (e) {
      setAnalyzeError({ message: errorMessage(e), retryable: (e as { retryable?: boolean }).retryable ?? true });
      setAnalyzing(false);
      router.refresh();
    }
  };

  const hasNew = files.length > 0 || pasted.trim() || teacherSaid.trim();

  return (
    <div className="flex flex-col gap-10">
      {errors.length > 0 && (
        <Alert tone="error" title="Allt gick inte att lägga till">
          <ul className="list-disc pl-4">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}

      <section>
        <SectionHeader title="Ditt underlag" description="Vi läser in varje fil separat så att allt kan spåras tillbaka till var det kom ifrån." />
        {materials.length === 0 ? (
          <EmptyState icon={FileText} title="Inget underlag ännu" description="Lägg till lärarens planering, betygskriterier eller bilder från genomgångar nedan." />
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {materials.map((m) => {
                const s = STATUS[m.processing_status as keyof typeof STATUS] ?? STATUS.uploaded;
                return (
                  <motion.li key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Card padded={false} className="p-4">
                      <div className="flex items-start gap-3">
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", m.processing_status === "failed" ? "bg-bad-soft text-bad" : "bg-surface-muted text-muted")}>
                          <MaterialIcon type={m.type} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-ink">{m.filename ?? "Material"}</p>
                            <Badge tone={s.tone}>
                              {m.processing_status === "processing" && <Loader2 className="animate-spin" />}
                              {m.processing_status === "ready" && <CheckCircle2 />}
                              {m.processing_status === "failed" && <AlertCircle />}
                              {s.label}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                            {m.type === "teacher_note" ? (
                              <span>Det här har läraren sagt</span>
                            ) : (
                              <select
                                defaultValue={m.category}
                                disabled={locked}
                                onChange={(e) => startTransition(async () => void (await updateMaterialCategory(m.id, e.target.value)))}
                                className="-ml-1 rounded-sm bg-transparent px-1 py-0.5 text-sm text-muted hover:text-ink"
                                aria-label="Typ av material"
                              >
                                {CATEGORY_OPTIONS.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            {m.processing_status === "ready" && (
                              <span>
                                {m.extraction_method ? METHOD[m.extraction_method] : ""}
                                {m.page_count ? ` · ${m.page_count} sidor` : ""} · {m.chars.toLocaleString("sv-SE")} tecken
                              </span>
                            )}
                          </div>
                          {m.processing_status === "failed" && m.error_message && <p className="mt-2 text-sm text-bad">{m.error_message}</p>}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {m.processing_status === "ready" && (
                            <Button variant="ghost" size="icon" onClick={() => setPreview(m)} aria-label="Visa inläst text">
                              <Eye />
                            </Button>
                          )}
                          {m.processing_status === "failed" && (
                            <Button variant="ghost" size="icon" onClick={() => retry(m)} aria-label="Försök igen">
                              <RotateCcw />
                            </Button>
                          )}
                          {!locked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Ta bort"
                              onClick={() =>
                                startTransition(async () => {
                                  await deleteMaterial(m.id);
                                  router.refresh();
                                })
                              }
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {!locked && (
        <section>
          {analyzeError && (
            <Alert tone="error" className="mb-3" title="Analysen misslyckades">
              {analyzeError.message}
            </Alert>
          )}
          <Card tone="ink" className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              {analyzing ? (
                <>
                  <p className="flex items-center gap-2 font-semibold">
                    <Loader2 className="size-4 animate-spin" /> Vi analyserar ditt underlag
                  </p>
                  <p className="mt-1 text-sm opacity-70">Varje område kopplas till var det står i underlaget. Det brukar ta 30–90 sekunder.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">
                    {analysisRunningElsewhere ? "En analys pågår redan" : projectStatus === "map_ready" ? "Lagt till mer? Gör om analysen." : "Klart med underlaget?"}
                  </p>
                  <p className="mt-1 text-sm opacity-70">
                    {busy ? "Vänta tills alla filer är inlästa." : ready === 0 ? "Lägg till minst ett material först." : `${ready} material är redo att analyseras.`}
                  </p>
                </>
              )}
            </div>
            <Button variant="brand" size="lg" onClick={analyze} disabled={busy || ready === 0 || analyzing} loading={analyzing}>
              {!analyzing && <Sparkles />} {projectStatus === "map_ready" ? "Analysera igen" : "Analysera underlaget"}
            </Button>
          </Card>
        </section>
      )}

      {!locked && (
        <section>
          <SectionHeader title="Lägg till mer" description="Ju mer av lärarens riktiga underlag du lägger in, desto bättre kan studieplanen anpassas." />
          <div className="flex flex-col gap-5">
            <FileDrop files={files} onChange={setFiles} />
            <div>
              <Label htmlFor="pasted">Klistra in text</Label>
              <Textarea id="pasted" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="T.ex. planeringen från lärplattformen" />
            </div>
            <div>
              <Label htmlFor="teacher">Det här har läraren sagt kommer på provet</Label>
              <Textarea id="teacher" value={teacherSaid} onChange={(e) => setTeacherSaid(e.target.value)} className="min-h-24" placeholder="Skriv så ordagrant du minns" />
            </div>
            {hasNew && (
              <Button onClick={addMaterials} loading={adding} size="lg" variant="secondary">
                Lägg till
              </Button>
            )}
          </div>
        </section>
      )}

      <Sheet open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} title={preview?.filename ?? "Material"} description="Så här läste vi in materialet. Det är den här texten som analysen bygger på.">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-text">{preview?.preview}</pre>
        {preview && preview.chars > 4000 && <p className="mt-4 text-xs text-muted">Visar de första 4 000 av {preview.chars.toLocaleString("sv-SE")} tecken.</p>}
      </Sheet>
    </div>
  );
}
