"use client";

import { useState, useTransition } from "react";
import { DownloadIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { AttachmentEntityRef } from "@/lib/actions/attachments";
import {
  deleteAttachment,
  getAttachmentDownloadUrl,
  renameAttachment,
} from "@/lib/actions/attachments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { Attachment } from "@/lib/data/attachments";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Nombre/Tipo/Categoría/Fecha/Subido por/Acciones (spec V2.2 punto 15). */
export function AttachmentList({
  attachments,
  entityRef,
}: {
  attachments: Attachment[];
  entityRef: AttachmentEntityRef;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleView(attachment: Attachment) {
    const result = await getAttachmentDownloadUrl(attachment.id, "view");
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleDownload(attachment: Attachment) {
    const result = await getAttachmentDownloadUrl(attachment.id, "download");
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  function openRename(attachment: Attachment) {
    setRenamingId(attachment.id);
    setRenameValue(attachment.file_name);
  }

  function handleRename() {
    if (!renamingId) return;
    startTransition(async () => {
      const result = await renameAttachment(renamingId, entityRef, renameValue);
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Archivo renombrado.");
      setRenamingId(null);
    });
  }

  function handleDelete() {
    if (!deletingId) return;
    const id = deletingId;
    startTransition(async () => {
      const result = await deleteAttachment(id, entityRef);
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Archivo eliminado.");
      setDeletingId(null);
    });
  }

  if (attachments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavía no hay archivos cargados.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Subido por</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attachments.map((attachment) => (
            <TableRow key={attachment.id}>
              <TableCell className="max-w-56 truncate font-medium">
                {attachment.file_name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatFileSize(attachment.file_size)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {attachment.category ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(attachment.created_at)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {attachment.uploaded_by_name ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Ver"
                    onClick={() => void handleView(attachment)}
                  >
                    <EyeIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Descargar"
                    onClick={() => void handleDownload(attachment)}
                  >
                    <DownloadIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Renombrar"
                    onClick={() => openRename(attachment)}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Eliminar"
                    onClick={() => setDeletingId(attachment.id)}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={renamingId !== null}
        onOpenChange={(open) => !open && setRenamingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar archivo</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenamingId(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleRename} disabled={isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar archivo</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El archivo se eliminará
              definitivamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingId(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
