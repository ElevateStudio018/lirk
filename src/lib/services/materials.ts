import "server-only";

import { transcribeImage } from "@/lib/ai/tasks/vision";
import { AIError } from "@/lib/ai/client";
import { hasMeaningfulText, MAX_VISION_BYTES, normalizeExtractedText } from "@/lib/materials/normalize";
import type { DB } from "@/lib/supabase/server";
import { dbError, notFound } from "./errors";

export const MATERIAL_BUCKET = "materials";

/**
 * Material pipeline: UPLOAD → STORE → EXTRACT → NORMALIZE (→ ANALYZE happens per project).
 * The upload + store steps happen in the browser directly against Supabase
 * Storage (RLS-protected). This function runs the EXTRACT and NORMALIZE steps
 * and records processing_status: uploaded → processing → ready | failed.
 * If nothing can be read, the material fails with a clear message – we never
 * make up content.
 */
export async function processMaterial(db: DB, materialId: string) {
  const { data: m, error } = await db.from("source_materials").select("*").eq("id", materialId).maybeSingle();
  if (error) dbError(error, "processMaterial.select");
  if (!m) throw notFound("Materialet");
  if (m.processing_status === "ready") return m;

  await db.from("source_materials").update({ processing_status: "processing", error_message: null }).eq("id", m.id);

  const fail = async (message: string) => {
    const { data } = await db
      .from("source_materials")
      .update({ processing_status: "failed", error_message: message, processed_at: new Date().toISOString() })
      .eq("id", m.id)
      .select()
      .single();
    return data ?? { ...m, processing_status: "failed", error_message: message };
  };

  try {
    let raw = "";
    let method: "pdf-text" | "plain" | "vision" | "user-input";
    let pageCount: number | null = null;

    if (m.type === "paste" || m.type === "teacher_note") {
      raw = m.extracted_text ?? "";
      method = "user-input";
    } else {
      if (!m.storage_path) return await fail("Filen saknas i lagringen. Ladda upp den igen.");
      const { data: blob, error: dlErr } = await db.storage.from(MATERIAL_BUCKET).download(m.storage_path);
      if (dlErr || !blob) return await fail("Filen kunde inte hämtas från lagringen. Ladda upp den igen.");
      const bytes = new Uint8Array(await blob.arrayBuffer());

      if (m.type === "pdf") {
        method = "pdf-text";
        try {
          const { extractText, getDocumentProxy } = await import("unpdf");
          const pdf = await getDocumentProxy(bytes);
          const { totalPages, text } = await extractText(pdf, { mergePages: false });
          pageCount = totalPages;
          raw = text.map((pageText, i) => `[Sida ${i + 1}]\n${pageText}`).join("\n\n");
        } catch {
          return await fail("PDF:en gick inte att öppna. Den kan vara skadad eller lösenordsskyddad.");
        }
        if (!hasMeaningfulText(raw.replace(/\[Sida \d+\]/g, ""))) {
          return await fail(
            "PDF:en innehåller ingen läsbar text – den är troligen inskannad. Fota eller ta skärmdumpar av sidorna och ladda upp dem som bilder.",
          );
        }
      } else if (m.type === "image") {
        method = "vision";
        if (bytes.byteLength > MAX_VISION_BYTES) return await fail("Bilden är för stor (max 15 MB). Ta en ny bild med lägre upplösning.");
        const mime = m.mime_type && m.mime_type.startsWith("image/") ? m.mime_type : "image/jpeg";
        if (mime === "image/heic" || mime === "image/heif") {
          return await fail("HEIC-bilder kan inte läsas. Välj 'Mest kompatibel' i iPhones kamerainställningar eller ta en skärmdump.");
        }
        const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
        const t = await transcribeImage(dataUrl, m.filename ?? "bild");
        if (!t.readable || !hasMeaningfulText(t.text + " " + (t.visual_description ?? ""))) {
          return await fail(`Bilden gick inte att läsa${t.problems ? `: ${t.problems}` : "."} Försök med en skarpare bild i bra ljus.`);
        }
        raw = t.text + (t.visual_description ? `\n\n[Bildbeskrivning: ${t.visual_description}]` : "");
      } else {
        method = "plain";
        raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      }
    }

    const normalized = normalizeExtractedText(raw);
    if (!hasMeaningfulText(normalized)) return await fail("Vi hittade ingen text i det här materialet.");

    const { data: updated, error: upErr } = await db
      .from("source_materials")
      .update({
        extracted_text: m.type === "paste" || m.type === "teacher_note" ? m.extracted_text : raw,
        normalized_text: normalized,
        extraction_method: method,
        page_count: pageCount,
        processing_status: "ready",
        error_message: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", m.id)
      .select()
      .single();
    if (upErr) dbError(upErr, "processMaterial.update");
    return updated;
  } catch (err) {
    if (err instanceof AIError) {
      await fail(err.code === "not_configured" ? "Bildtolkning kräver att AI är aktiverat på servern." : err.message);
      throw err;
    }
    await fail("Något gick fel när materialet lästes. Försök igen.");
    throw err;
  }
}
