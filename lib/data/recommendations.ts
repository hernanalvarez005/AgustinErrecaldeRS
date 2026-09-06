import "server-only";

import { createClient } from "@/lib/supabase/server";

const RECOMMENDATION_COLUMNS =
  "id, property_id, search_id, contact_id, sent_at, channel, status, notes, updated_at";

export type PropertyRecommendationRow = Awaited<
  ReturnType<typeof getRecommendationsForProperty>
>[number];

/** Every property sent for this property, most recent first — "Interesados" tab (V2 bloque G). */
export async function getRecommendationsForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data: recommendations, error } = await supabase
    .from("property_recommendations")
    .select(RECOMMENDATION_COLUMNS)
    .eq("property_id", propertyId)
    .order("sent_at", { ascending: false });
  if (error) {
    console.error(
      "Failed to load recommendations for property:",
      error.message,
    );
    return [];
  }
  if (recommendations.length === 0) return [];

  const contactIds = [...new Set(recommendations.map((r) => r.contact_id))];
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .in("id", contactIds);
  if (contactsError) {
    console.error(
      "Failed to load contacts for recommendations:",
      contactsError.message,
    );
  }
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

  return recommendations.map((r) => ({
    ...r,
    contact: contactById.get(r.contact_id) ?? null,
  }));
}

/** Every property sent to this contact, most recent first — shown on the contact ficha (V2 bloque G). */
export async function getRecommendationsForContact(contactId: string) {
  const supabase = await createClient();
  const { data: recommendations, error } = await supabase
    .from("property_recommendations")
    .select(RECOMMENDATION_COLUMNS)
    .eq("contact_id", contactId)
    .order("sent_at", { ascending: false });
  if (error) {
    console.error("Failed to load recommendations for contact:", error.message);
    return [];
  }
  if (recommendations.length === 0) return [];

  const propertyIds = [...new Set(recommendations.map((r) => r.property_id))];
  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id, title")
    .in("id", propertyIds);
  if (propertiesError) {
    console.error(
      "Failed to load properties for recommendations:",
      propertiesError.message,
    );
  }
  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));

  return recommendations.map((r) => ({
    ...r,
    property: propertyById.get(r.property_id) ?? null,
  }));
}
