import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * All acquisitions for the Kanban/table view, with the property title and
 * owner name resolved in two extra queries (not per-row) — same "avoid
 * N+1" approach as lib/data/today.ts.
 */
export async function listAcquisitions(organizationId: string) {
  const supabase = await createClient();
  const { data: acquisitions, error } = await supabase
    .from("acquisition_overview")
    .select(
      "id, property_id, primary_owner_contact_id, status, origin, estimated_value, next_action_at, last_interaction_at, pending_tasks_count, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to list acquisitions:", error.message);
    return [];
  }
  if (acquisitions.length === 0) return [];

  const propertyIds = [...new Set(acquisitions.map((a) => a.property_id))];
  const contactIds = [
    ...new Set(acquisitions.map((a) => a.primary_owner_contact_id)),
  ];

  const [
    { data: properties, error: propertiesError },
    { data: contacts, error: contactsError },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, city, neighborhood")
      .in("id", propertyIds),
    supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .in("id", contactIds),
  ]);

  if (propertiesError)
    console.error(
      "Failed to load properties for acquisitions:",
      propertiesError.message,
    );
  if (contactsError)
    console.error(
      "Failed to load contacts for acquisitions:",
      contactsError.message,
    );

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

  return acquisitions.map((a) => ({
    ...a,
    property: propertyById.get(a.property_id) ?? null,
    owner: contactById.get(a.primary_owner_contact_id) ?? null,
  }));
}

export async function getAcquisition(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_acquisitions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to load acquisition:", error.message);
    return null;
  }
  return data;
}

export async function getValuations(acquisitionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("valuations")
    .select("*")
    .eq("acquisition_id", acquisitionId)
    .order("valuation_date", { ascending: false });
  if (error) {
    console.error("Failed to load valuations:", error.message);
    return [];
  }
  return data;
}
