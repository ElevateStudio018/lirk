"use client";

import { FileText, ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_OPTIONS, guessCategory, type MaterialCategory } from "./use-uploader";

export type PendingFile = { file: File; category: MaterialCategory; key: string };

export function FileDrop({ files, onChange }: { files: PendingFile[]; onChange: (files: PendingFile[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      next.push({ file, category: guessCategory(file.name), key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}` });
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors",
          drag ? "border-brand bg-brand-soft" : "border-border-strong bg-surface hover:border-ink",
        )}
      >
        <span className="grid size-12 place-items-center rounded-full bg-surface-muted">
          <Upload className="size-6 text-ink" aria-hidden />
        </span>
        <span className="text-base font-semibold text-ink">Välj filer eller ta en bild</span>
        <span className="text-sm text-muted">PDF, bilder (JPG/PNG) och textfiler · max 25 MB</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,text/markdown,.md,.txt"
        className="sr-only"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li key={f.key} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
              {f.file.type.startsWith("image/") ? <ImageIcon className="size-5 shrink-0 text-muted" /> : <FileText className="size-5 shrink-0 text-muted" />}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{f.file.name}</span>
              <select
                value={f.category}
                onChange={(e) => onChange(files.map((x) => (x.key === f.key ? { ...x, category: e.target.value as MaterialCategory } : x)))}
                className="h-9 rounded-sm border border-border bg-surface px-2 text-sm text-ink"
                aria-label={`Typ av material för ${f.file.name}`}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x.key !== f.key))}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-ink"
                aria-label={`Ta bort ${f.file.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
