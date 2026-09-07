"use client";

import { useRef, useState, useTransition } from "react";
import { UploadIcon } from "lucide-react";
import { toast } from "sonner";

import type { AttachmentEntityRef } from "@/lib/actions/attachments";
import { createAttachment } from "@/lib/actions/attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  ATTACHMENT_MAX_FILE_SIZE_LABEL,
  isAttachmentTypeAllowed,
} from "@/lib/validations/attachment";

/** Strips anything that isn't safe in a Storage object path segment. */
function sanitizeFileName(fileName: string): string {
  return fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
}

/**
 * Uploads directly from the browser to the private `attachments` bucket
 * (Storage RLS scopes the write to this organization's path prefix, spec
 * V2.2 punto 5), then calls the `createAttachment` Server Action to write
 * the metadata row — this component never routes file bytes through a
 * Server Action.
 */
export function AttachmentUploadForm({
  entityRef,
  organizationId,
  categories,
  onUploaded,
}: {
  entityRef: AttachmentEntityRef;
  organizationId: string;
  categories: readonly string[];
  onUploaded?: () => void;
}) {
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const entityKind = entityRef.contactId ? "contacts" : "properties";
  const entityId = entityRef.contactId ?? entityRef.propertyId!;

  async function handleFile(file: File) {
    if (!isAttachmentTypeAllowed(file.name, file.type)) {
      toast.error(
        "Tipo de archivo no permitido. Usá PDF, imagen (JPG/PNG/WEBP) o Word/Excel.",
      );
      return;
    }
    if (file.size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      toast.error(
        `El archivo supera el límite de ${ATTACHMENT_MAX_FILE_SIZE_LABEL}.`,
      );
      return;
    }

    setIsUploading(true);
    const supabase = createClient();
    const storagePath = `${organizationId}/${entityKind}/${entityId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
      console.error("Failed to upload attachment:", uploadError.message);
      toast.error("No pudimos subir el archivo. Probá de nuevo.");
      setIsUploading(false);
      return;
    }

    startTransition(async () => {
      const result = await createAttachment(entityRef, {
        fileName: file.name,
        storagePath,
        mimeType: file.type,
        fileSize: file.size,
        category: category || undefined,
        description: description || undefined,
      });

      if ("error" in result) {
        // The file is already in Storage but the metadata insert failed —
        // clean it up here rather than leaving an orphaned object with no
        // corresponding row (spec punto 14: "evitar archivos huérfanos
        // cuando sea posible"). Best-effort: if this delete also fails,
        // the object is inert (not linked to anything, still scoped to
        // this org by Storage RLS) and can be cleaned up later.
        const { error: cleanupError } = await supabase.storage
          .from("attachments")
          .remove([storagePath]);
        if (cleanupError) {
          console.error(
            "Failed to clean up orphaned upload:",
            cleanupError.message,
          );
        }
        toast.error(result.error);
        setIsUploading(false);
        return;
      }

      toast.success("Archivo subido.");
      setCategory("");
      setDescription("");
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.();
    });
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="attachment-category">Categoría (opcional)</Label>
          <Select
            value={category || null}
            onValueChange={(v) => setCategory(v ?? "")}
            items={Object.fromEntries(categories.map((c) => [c, c]))}
          >
            <SelectTrigger id="attachment-category" className="w-full">
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="attachment-description">Descripción (opcional)</Label>
          <Input
            id="attachment-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Escritura firmada"
          />
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-input"
        }`}
      >
        <UploadIcon className="text-muted-foreground size-5" />
        <p className="text-muted-foreground text-sm">
          Arrastrá un archivo o{" "}
          <button
            type="button"
            className="text-foreground underline underline-offset-2"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            elegilo
          </button>
        </p>
        <p className="text-muted-foreground text-xs">
          PDF, imagen o Word/Excel · hasta {ATTACHMENT_MAX_FILE_SIZE_LABEL}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={handleInputChange}
          disabled={isUploading}
        />
      </div>

      {isUploading ? (
        <Button type="button" size="sm" disabled className="w-full sm:w-auto">
          Subiendo…
        </Button>
      ) : null}
    </div>
  );
}
