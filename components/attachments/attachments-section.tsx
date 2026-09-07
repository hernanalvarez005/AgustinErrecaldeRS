"use client";

import { useState } from "react";

import { AttachmentList } from "@/components/attachments/attachment-list";
import { AttachmentUploadForm } from "@/components/attachments/attachment-upload-form";
import type { AttachmentEntityRef } from "@/lib/actions/attachments";
import type { Attachment } from "@/lib/data/attachments";

/**
 * Drops into a ficha (contacts/[id] — bloque 3, properties/[id] — bloque
 * 4): upload form on top, table below. `attachments` comes from the
 * server-rendered page (lib/data/attachments.ts's listAttachments); after
 * an upload/rename/delete the Server Actions already call revalidatePath
 * on the entity's route, so this component doesn't need its own refetch —
 * `onUploaded` here is just a visual nudge, not required for correctness.
 */
export function AttachmentsSection({
  attachments,
  entityRef,
  organizationId,
  categories,
}: {
  attachments: Attachment[];
  entityRef: AttachmentEntityRef;
  organizationId: string;
  categories: readonly string[];
}) {
  const [uploadKey, setUploadKey] = useState(0);

  return (
    <div className="space-y-4">
      <AttachmentUploadForm
        key={uploadKey}
        entityRef={entityRef}
        organizationId={organizationId}
        categories={categories}
        onUploaded={() => setUploadKey((k) => k + 1)}
      />
      <AttachmentList attachments={attachments} entityRef={entityRef} />
    </div>
  );
}
