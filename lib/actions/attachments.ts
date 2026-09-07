"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createAttachmentSchema,
  renameAttachmentSchema,
} from "@/lib/validations/attachment";

/** Exactly one of these two — mirrors the DB's `attachments_exactly_one_entity` check. */
export type AttachmentEntityRef =
  | { contactId: string; propertyId?: undefined }
  | { propertyId: string; contactId?: undefined };

function revalidateEntity(ref: AttachmentEntityRef) {
  if (ref.contactId) revalidatePath(`/contacts/${ref.contactId}`);
  if (ref.propertyId) revalidatePath(`/properties/${ref.propertyId}`);
}

/**
 * Writes the metadata row after the browser has already uploaded the file
 * directly to Storage (components/attachments/attachment-upload-form.tsx)
 * — this action never touches the file bytes, only records what/where.
 * Direct-to-Storage upload from the browser (not proxied through this
 * Server Action) avoids routing potentially-large files through a Vercel
 * serverless function body.
 */
export async function createAttachment(
  ref: AttachmentEntityRef,
  input: {
    fileName: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    category?: string;
    description?: string;
  },
): Promise<{ error: string } | { success: true }> {
  const membership = await requireMembership();
  const parsed = createAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert({
    organization_id: membership.organization.id,
    contact_id: ref.contactId ?? null,
    property_id: ref.propertyId ?? null,
    file_name: parsed.data.fileName,
    storage_path: parsed.data.storagePath,
    mime_type: parsed.data.mimeType,
    file_size: parsed.data.fileSize,
    category: parsed.data.category ?? null,
    description: parsed.data.description ?? null,
  });

  if (error) {
    console.error("Failed to save attachment record:", error.message);
    // The file is already sitting in Storage at this point (upload
    // succeeded, only this metadata insert failed) — the caller
    // (components/attachments/attachment-upload-form.tsx) removes the
    // orphaned object itself on this response, since it already holds the
    // storage path and Storage's own RLS lets the uploader delete what
    // they just uploaded.
    return { error: "No pudimos guardar el archivo. Probá de nuevo." };
  }

  revalidateEntity(ref);
  return { success: true };
}

/**
 * A short-lived signed URL for viewing/downloading one attachment (spec
 * V2.2 punto 6 — never a permanent public URL). Generated fresh on every
 * call with the request-scoped, RLS-respecting client (lib/supabase/server.ts)
 * — if the caller isn't a member of the attachment's organization, both
 * the `attachments` SELECT (RLS) and the Storage `createSignedUrl` call
 * (Storage RLS on `storage.objects`) fail independently, so this is
 * enforced twice, not just trusted from the row lookup.
 */
export async function getAttachmentDownloadUrl(
  attachmentId: string,
  mode: "view" | "download" = "view",
): Promise<{ url: string; fileName: string } | { error: string }> {
  const supabase = await createClient();

  const { data: attachment, error: fetchError } = await supabase
    .from("attachments")
    .select("storage_path, file_name")
    .eq("id", attachmentId)
    .maybeSingle();

  if (fetchError || !attachment) {
    return { error: "No pudimos encontrar el archivo." };
  }

  // "download" adds Content-Disposition: attachment (spec punto 13/10 —
  // "Ver" opens inline in a new tab, browsers already render PDF/imágenes
  // natively; "Descargar" forces a save-to-disk instead).
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, 120, {
      download: mode === "download" ? attachment.file_name : undefined,
    }); // 2 min — enough to open/download, not a link worth sharing

  if (error || !data) {
    console.error(
      "Failed to create signed URL:",
      error?.message ?? "unknown error",
    );
    return { error: "No pudimos generar el link de descarga." };
  }

  return { url: data.signedUrl, fileName: attachment.file_name };
}

export async function renameAttachment(
  attachmentId: string,
  ref: AttachmentEntityRef,
  newFileName: string,
): Promise<{ error: string } | { success: true }> {
  const parsed = renameAttachmentSchema.safeParse({ fileName: newFileName });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nombre inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("attachments")
    .update({ file_name: parsed.data.fileName })
    .eq("id", attachmentId);

  if (error) {
    console.error("Failed to rename attachment:", error.message);
    return { error: "No pudimos renombrar el archivo." };
  }

  revalidateEntity(ref);
  return { success: true };
}

/**
 * Delete requires confirmation in the UI (spec punto 14) before this ever
 * runs. Order matters: Storage object first, DB row second — a delete
 * that fails after removing the Storage object but before removing the
 * row just leaves a row pointing at nothing, which shows up as a broken
 * download the user can retry deleting (idempotent: deleting an
 * already-gone Storage object is treated as success, same pattern already
 * used for Google Calendar event deletion). The other order (DB row
 * first) risks the worse failure mode — a "deleted" file that's actually
 * still sitting in Storage with no record pointing at it, invisible to
 * any future cleanup.
 */
export async function deleteAttachment(
  attachmentId: string,
  ref: AttachmentEntityRef,
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();

  const { data: attachment, error: fetchError } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();

  if (fetchError || !attachment) {
    return { error: "No pudimos encontrar el archivo." };
  }

  const { error: storageError } = await supabase.storage
    .from("attachments")
    .remove([attachment.storage_path]);
  if (storageError) {
    console.error(
      "Failed to delete attachment from storage:",
      storageError.message,
    );
    return { error: "No pudimos eliminar el archivo. Probá de nuevo." };
  }

  const { error: dbError } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId);
  if (dbError) {
    console.error("Failed to delete attachment record:", dbError.message);
    return {
      error:
        "El archivo se eliminó pero no pudimos actualizar el registro. Probá de nuevo.",
    };
  }

  revalidateEntity(ref);
  return { success: true };
}
