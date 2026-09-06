import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  SearchObjective,
  SearchStatus,
  SearchUrgency,
} from "@/types/database.types";

export async function listSearches({
  organizationId,
  status,
  objective,
  urgency,
  city,
  minBedrooms,
}: {
  organizationId: string;
  status?: SearchStatus;
  objective?: SearchObjective;
  urgency?: SearchUrgency;
  city?: string;
  minBedrooms?: number;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("search_overview")
    .select(
      "id, contact_id, contact_first_name, contact_last_name, operation_type, property_types, min_price, max_price, currency, cities, objective, urgency, status, last_interaction_at, next_action_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (objective) query = query.eq("objective", objective);
  if (urgency) query = query.eq("urgency", urgency);
  if (city) query = query.contains("cities", [city]);
  if (minBedrooms !== undefined) query = query.gte("min_bedrooms", minBedrooms);

  const { data, error } = await query.limit(200);
  if (error) {
    console.error("Failed to list searches:", error.message);
    return [];
  }
  return data;
}

/**
 * Every field the contact ficha's "necesidad activa" summary shows (V2
 * bloque F) — not just type + status like before, so a client with
 * several searches (docs/PRODUCT_SPEC.md: never reduce a client to one
 * need) shows each one's full picture without navigating away.
 */
export async function listSearchesByContact(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_searches")
    .select(
      "id, operation_type, property_types, cities, neighborhoods, min_price, max_price, currency, min_bedrooms, max_bedrooms, objective, urgency, status",
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to list contact searches:", error.message);
    return [];
  }
  return data;
}

export async function getSearch(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_searches")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to load search:", error.message);
    return null;
  }
  return data;
}
