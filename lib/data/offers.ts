import "server-only";

import { createClient } from "@/lib/supabase/server";

const OFFER_COLUMNS =
  "id, property_id, contact_id, deal_id, amount, currency, status, conditions, expiration_date, parent_offer_id, notes, created_at";

export type PropertyOffer = Awaited<
  ReturnType<typeof getOffersForProperty>
>[number];

/** Every offer on a property, oldest first — reads top-to-bottom as the negotiation happened (V2 bloque E). */
export async function getOffersForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data: offers, error } = await supabase
    .from("offers")
    .select(OFFER_COLUMNS)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load offers for property:", error.message);
    return [];
  }
  if (offers.length === 0) return [];

  const contactIds = [...new Set(offers.map((o) => o.contact_id))];
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .in("id", contactIds);
  if (contactsError) {
    console.error("Failed to load contacts for offers:", contactsError.message);
  }
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

  return offers.map((o) => ({
    ...o,
    contact: contactById.get(o.contact_id) ?? null,
  }));
}

export async function getOffer(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to load offer:", error.message);
    return null;
  }
  return data;
}

/** An open (not closed/cancelled) deal for this property, if one already exists — used to avoid creating a duplicate deal when an offer is accepted (V2 bloque E). */
export async function getOpenDealForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("id")
    .eq("property_id", propertyId)
    .not("status", "in", "(closed,cancelled)")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(
      "Failed to check for an open deal on property:",
      error.message,
    );
    return null;
  }
  return data;
}
