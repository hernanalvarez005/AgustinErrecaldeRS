import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Shared across every entity that can have notes/tasks/activities attached
 * (contacts, properties, acquisitions, searches, leads, deals, more later).
 * Exactly one of these should be set per call — see docs/DATABASE.md on why
 * these are plain nullable FK columns rather than a polymorphic
 * "entity_type" column.
 */
export type EngagementContext = {
  contactId?: string;
  propertyId?: string;
  acquisitionId?: string;
  searchId?: string;
  leadId?: string;
  dealId?: string;
};

function scopeQuery<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  context: EngagementContext,
): T {
  let scoped = query;
  if (context.contactId) scoped = scoped.eq("contact_id", context.contactId);
  if (context.propertyId) scoped = scoped.eq("property_id", context.propertyId);
  if (context.acquisitionId)
    scoped = scoped.eq("acquisition_id", context.acquisitionId);
  if (context.searchId) scoped = scoped.eq("search_id", context.searchId);
  if (context.leadId) scoped = scoped.eq("lead_id", context.leadId);
  if (context.dealId) scoped = scoped.eq("deal_id", context.dealId);
  return scoped;
}

export async function getNotes(context: EngagementContext) {
  const supabase = await createClient();
  const query = scopeQuery(
    supabase.from("notes").select("id, body, created_at"),
    context,
  );
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load notes:", error.message);
    return [];
  }
  return data;
}

export async function getTasks(context: EngagementContext) {
  const supabase = await createClient();
  const query = scopeQuery(
    supabase
      .from("tasks")
      .select("id, title, priority, due_at, status, completed_at"),
    context,
  );
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
  const query = scopeQuery(
    supabase
      .from("activities")
      .select("id, type, description, starts_at, status"),
    context,
  );
  const { data, error } = await query.order("starts_at", { ascending: false });
  if (error) {
    console.error("Failed to load activities:", error.message);
    return [];
  }
  return data;
}
