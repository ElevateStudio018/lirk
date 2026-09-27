/**
 * NORMALIZE step of the material pipeline. Pure and deterministic: it only
 * cleans up extraction artefacts and never adds or rewrites content.
 */
export function normalizeExtractedText(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, "\n")
      // control characters except newline/tab
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      // soft hyphens / zero-width characters
      .replace(/[­​-‍﻿]/g, "")
      .replace(/ /g, " ")
      // words hyphenated across a line break: "klimat-\nförändring" → "klimatförändring"
      .replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2")
      // typographic ligatures from PDFs
      .replace(/ﬁ/g, "fi")
      .replace(/ﬂ/g, "fl")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Meaningful content = at least a few real words. */
export function hasMeaningfulText(text: string): boolean {
  const words = text.match(/\p{L}{2,}/gu) ?? [];
  return words.length >= 5;
}

export const SUPPORTED_UPLOADS = {
  pdf: ["application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"],
  text: ["text/plain", "text/markdown", "text/csv"],
} as const;

export function materialTypeFor(mime: string, filename: string): "pdf" | "image" | "text" | null {
  const lower = filename.toLowerCase();
  if ((SUPPORTED_UPLOADS.pdf as readonly string[]).includes(mime) || lower.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if ((SUPPORTED_UPLOADS.text as readonly string[]).includes(mime) || /\.(txt|md|markdown|csv)$/.test(lower)) return "text";
  return null;
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_VISION_BYTES = 15 * 1024 * 1024;
