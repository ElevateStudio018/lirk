"use client";

import { useCallback } from "react";
import { postJSON } from "@/lib/api/client";
import { MAX_UPLOAD_BYTES, materialTypeFor } from "@/lib/materials/normalize";
import { createClient } from "@/lib/supabase/client";

export type MaterialCategory = "planning" | "criteria" | "notes" | "teacher_said" | "other";

export const CATEGORY_OPTIONS: Array<{ value: MaterialCategory; label: string }> = [
  { value: "planning", label: "Planering" },
  { value: "criteria", label: "Betygskriterier" },
  { value: "notes", label: "Anteckningar / genomgång" },
  { value: "other", label: "Övrigt" },
];

export function guessCategory(filename: string): MaterialCategory {
  const f = filename.toLowerCase();
  if (/(kriteri|kunskapskrav|matris|bedömning|betyg)/.test(f)) return "criteria";
  if (/(planering|pedagogisk|lpp|plan)/.test(f)) return "planning";
  if (/(anteckning|genomgång|tavla|notes)/.test(f)) return "notes";
  return "other";
}

function safeName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);
}

/**
 * UPLOAD + STORE: the browser uploads directly to the private Storage bucket
 * (RLS limits every user to their own folder), registers the material row and
 * asks the server to run EXTRACT + NORMALIZE.
 */
export function useUploader() {
  const uploadFile = useCallback(async (projectId: string, file: File, category: MaterialCategory) => {
    const type = materialTypeFor(file.type, file.name);
    if (!type) throw new Error(`${file.name}: filtypen stöds inte. Använd PDF, bild eller textfil.`);
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: filen är större än 25 MB.`);

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Du är utloggad. Logga in igen.");

    const path = `${auth.user.id}/${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error: upErr } = await supabase.storage.from("materials").upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (upErr) throw new Error(`${file.name}: uppladdningen misslyckades. Försök igen.`);

    const { data, error } = await supabase
      .from("source_materials")
      .insert({
        project_id: projectId,
        type,
        category,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        storage_path: path,
        processing_status: "uploaded",
      })
      .select("id")
      .single();
    if (error) {
      await supabase.storage.from("materials").remove([path]);
      throw new Error(`${file.name}: kunde inte registreras.`);
    }
    return data.id;
  }, []);

  const processMaterial = useCallback(async (materialId: string) => {
    return postJSON<{ id: string; status: string; error: string | null }>(`/api/materials/${materialId}/process`);
  }, []);

  return { uploadFile, processMaterial };
}
