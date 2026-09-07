import { z } from "zod";

/**
 * V2.2 bloque 2, spec punto 9: "Definir límite razonable y centralizado...
 * no hardcodear el límite en múltiples componentes." Single source of
 * truth for both the client-side upload form (immediate feedback before
 * spending bandwidth) and the server action (the real enforcement point —
 * never trust the client alone). Mirrored in the DB check constraint on
 * `attachments.file_size` (supabase/migrations/20260907150000_attachments.sql)
 * as a second, independent layer — same "defense in depth" already used
 * for other business rules in this schema (e.g. status check constraints
 * exist in the DB even though Zod also validates them).
 */
export const ATTACHMENT_MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const ATTACHMENT_MAX_FILE_SIZE_LABEL = "15 MB";

/**
 * Extension → MIME type, both required to match (spec punto 8: "no
 * confiar únicamente en extensión"). A file whose reported MIME type
 * isn't in this map, or whose extension doesn't map to that same MIME
 * type, is rejected — narrows the case of a renamed file lying about what
 * it is more than checking either alone would.
 */
export const ATTACHMENT_ALLOWED_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function getFileExtension(fileName: string): string | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName.trim());
  return match ? match[1].toLowerCase() : null;
}

/**
 * True only if the extension is on the allow-list AND the reported MIME
 * type is exactly the one that extension maps to — not just "is the MIME
 * type allowed at all" (see module doc comment).
 */
export function isAttachmentTypeAllowed(
  fileName: string,
  mimeType: string,
): boolean {
  const extension = getFileExtension(fileName);
  if (!extension) return false;
  const expectedMime = ATTACHMENT_ALLOWED_TYPES[extension];
  return expectedMime !== undefined && expectedMime === mimeType;
}

/** Suggested categories per entity — a nudge in the UI, not a DB enum (spec punto 11: "no obligar a categorizar si degrada velocidad de carga" — the DB column is plain nullable text). */
export const CONTACT_ATTACHMENT_CATEGORIES = [
  "DNI",
  "Documentación",
  "Comprobante",
  "Otro",
] as const;

export const PROPERTY_ATTACHMENT_CATEGORIES = [
  "Plano",
  "Escritura",
  "Tasación",
  "Reglamento",
  "Imagen",
  "Informe",
  "Otro",
] as const;

export const createAttachmentSchema = z.object({
  fileName: z.string().trim().min(1, "Falta el nombre del archivo."),
  storagePath: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  fileSize: z
    .number()
    .positive()
    .max(
      ATTACHMENT_MAX_FILE_SIZE_BYTES,
      `El archivo supera el límite de ${ATTACHMENT_MAX_FILE_SIZE_LABEL}.`,
    ),
  category: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().optional(),
  ),
  description: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().optional(),
  ),
});

export const renameAttachmentSchema = z.object({
  fileName: z.string().trim().min(1, "Ingresá un nombre."),
});
