import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * All deals for the Kanban/table view, with property/buyer/seller resolved
 * in a handful of extra queries (not per-row) — same "avoid N+1" approach
 * as lib/data/acquisitions.ts.
 */
export async function listDeals(organizationId: string) {
  const supabase = await createClient();
  const { data: deals, error } = await supabase
    .from("deal_overview")
    .select(
      "id, property_id, buyer_contact_id, seller_contact_id, deal_type, status, asking_price, offer_price, agreed_price, currency, next_action_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to list deals:", error.message);
    return [];
  }
  if (deals.length === 0) return [];

  const propertyIds = [...new Set(deals.map((d) => d.property_id))];
  const contactIds = [
    ...new Set(deals.flatMap((d) => [d.buyer_contact_id, d.seller_contact_id])),
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
      "Failed to load properties for deals:",
      propertiesError.message,
    );
  if (contactsError)
    console.error("Failed to load contacts for deals:", contactsError.message);

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

  return deals.map((d) => ({
    ...d,
    property: propertyById.get(d.property_id) ?? null,
    buyer: contactById.get(d.buyer_contact_id) ?? null,
    seller: contactById.get(d.seller_contact_id) ?? null,
  }));
}

export async function getDeal(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to load deal:", error.message);
    return null;
  }
  return data;
}
