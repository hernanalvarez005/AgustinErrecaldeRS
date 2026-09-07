import "server-only";

import { createClient } from "@/lib/supabase/server";

const ATTACHMENT_COLUMNS =
  "id, organization_id, contact_id, property_id, file_name, storage_path, mime_type, file_size, category, description, uploaded_by, created_at";

export type Attachment = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  property_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  category: string | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
  /** Resolved separately from `profiles` — see listAttachments. Display-only. */
  uploaded_by_name: string | null;
};

async function attachUploaderNames<T extends { uploaded_by: string | null }>(
  rows: T[],
): Promise<(T & { uploaded_by_name: string | null })[]> {
  const userIds = [
    ...new Set(
      rows.map((r) => r.uploaded_by).filter((v): v is string => Boolean(v)),
    ),
  ];
  if (userIds.length === 0) {
    return rows.map((r) => ({ ...r, uploaded_by_name: null }));
  }

  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds);

  if (error) {
    console.error("Failed to load uploader profiles:", error.message);
    return rows.map((r) => ({ ...r, uploaded_by_name: null }));
  }

  const nameById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
    ]),
  );
  return rows.map((r) => ({
    ...r,
    uploaded_by_name: r.uploaded_by
      ? (nameById.get(r.uploaded_by) ?? null)
      : null,
  }));
}

/**
 * Files attached to a contact or a property — never both in one call (each
 * page passes exactly one of `contactId`/`propertyId`, matching the DB's
 * own `attachments_exactly_one_entity` check).
 */
export async function listAttachments({
  contactId,
  propertyId,
}: {
  contactId?: string;
  propertyId?: string;
}): Promise<Attachment[]> {
  const supabase = await createClient();
  let query = supabase
    .from("attachments")
    .select(ATTACHMENT_COLUMNS)
    .order("created_at", { ascending: false });

  if (contactId) query = query.eq("contact_id", contactId);
  if (propertyId) query = query.eq("property_id", propertyId);

  const { data, error } = await query;
  if (error) {
    console.error("Failed to list attachments:", error.message);
    return [];
  }
  return attachUploaderNames(data);
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select(ATTACHMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load attachment:", error.message);
    return null;
  }
  if (!data) return null;
  const [withName] = await attachUploaderNames([data]);
  return withName;
}
