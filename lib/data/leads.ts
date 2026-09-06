import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ContactSource, LeadStatus } from "@/types/database.types";

export async function listLeads({
  organizationId,
  status,
  source,
  search,
}: {
  organizationId: string;
  status?: LeadStatus;
  source?: ContactSource;
  search?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("lead_overview")
    .select(
      "id, first_name, last_name, phone, email, message, source, property_id, status, created_at, last_interaction_at, next_action_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source);
  if (search) {
    const term = `%${search}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`,
    );
  }

  const { data, error } = await query.limit(200);
  if (error) {
    console.error("Failed to list leads:", error.message);
    return [];
  }
  return data;
}

export async function getLead(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to load lead:", error.message);
    return null;
  }
  return data;
}
