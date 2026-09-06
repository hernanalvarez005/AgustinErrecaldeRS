import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Shared across every entity that can have notes/tasks/activities attached
 * (contacts today, properties from Fase 2, more later). Exactly one of
 * these should be set per call — see docs/DATABASE.md on why these are
 * plain nullable FK columns rather than a polymorphic "entity_type" column.
 */
export type EngagementContext = { contactId?: string; propertyId?: string };

export async function getNotes(context: EngagementContext) {
  const supabase = await createClient();
  let query = supabase.from("notes").select("id, body, created_at");
  if (context.contactId) query = query.eq("contact_id", context.contactId);
  if (context.propertyId) query = query.eq("property_id", context.propertyId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load notes:", error.message);
    return [];
  }
  return data;
}

export async function getTasks(context: EngagementContext) {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, title, priority, due_at, status, completed_at");
  if (context.contactId) query = query.eq("contact_id", context.contactId);
  if (context.propertyId) query = query.eq("property_id", context.propertyId);

  const { data, error } = await query.order("due_at", {
    ascending: true,
    nullsFirst: false,
  });
  if (error) {
    console.error("Failed to load tasks:", error.message);
    return [];
  }
  return data;
}

export async function getActivities(context: EngagementContext) {
  const supabase = await createClient();
  let query = supabase
    .from("activities")
    .select("id, type, description, starts_at, status");
  if (context.contactId) query = query.eq("contact_id", context.contactId);
  if (context.propertyId) query = query.eq("property_id", context.propertyId);

  const { data, error } = await query.order("starts_at", { ascending: false });
  if (error) {
    console.error("Failed to load activities:", error.message);
    return [];
  }
  return data;
}
