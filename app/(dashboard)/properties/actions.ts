"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { getOpenDealForProperty } from "@/lib/data/offers";
import { createClient } from "@/lib/supabase/server";
import {
  counterOfferSchema,
  offerSchema,
  OFFER_STATUSES,
} from "@/lib/validations/offer";
import { propertySchema } from "@/lib/validations/property";
import type { OfferStatus } from "@/types/database.types";

function propertyFieldsFromFormData(formData: FormData) {
  return {
    title: formData.get("title"),
    propertyType: formData.get("propertyType"),
    operationType: formData.get("operationType"),
    status: formData.get("status") || undefined,
    street: formData.get("street"),
    streetNumber: formData.get("streetNumber"),
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood"),
    province: formData.get("province"),
    price: formData.get("price"),
    currency: formData.get("currency"),
    bedrooms: formData.get("bedrooms"),
    bathrooms: formData.get("bathrooms"),
    garageSpaces: formData.get("garageSpaces"),
    totalArea: formData.get("totalArea"),
    coveredArea: formData.get("coveredArea"),
    expenses: formData.get("expenses"),
    description: formData.get("description"),
  };
}

function failCreate(message: string): never {
  redirect(`/properties/new?error=${encodeURIComponent(message)}`);
}

function failUpdate(propertyId: string, message: string): never {
  redirect(
    `/properties/${propertyId}/edit?error=${encodeURIComponent(message)}`,
  );
}

export async function createProperty(formData: FormData) {
  const membership = await requireMembership();
  const parsed = propertySchema.safeParse(propertyFieldsFromFormData(formData));
  if (!parsed.success) {
    failCreate(
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const supabase = await createClient();
  const { data: property, error } = await supabase
    .from("properties")
    .insert({
      organization_id: membership.organization.id,
      title: parsed.data.title,
      property_type: parsed.data.propertyType,
      operation_type: parsed.data.operationType,
      status: parsed.data.status,
      street: parsed.data.street ?? null,
      street_number: parsed.data.streetNumber ?? null,
      city: parsed.data.city ?? null,
      neighborhood: parsed.data.neighborhood ?? null,
      province: parsed.data.province ?? null,
      price: parsed.data.price ?? null,
      currency: parsed.data.currency ?? null,
      bedrooms: parsed.data.bedrooms ?? null,
      bathrooms: parsed.data.bathrooms ?? null,
      garage_spaces: parsed.data.garageSpaces ?? null,
      total_area: parsed.data.totalArea ?? null,
      covered_area: parsed.data.coveredArea ?? null,
      expenses: parsed.data.expenses ?? null,
      description: parsed.data.description ?? null,
    })
    .select("id")
    .single();

  if (error || !property) {
    console.error("Failed to create property:", error?.message);
    failCreate("No pudimos guardar la propiedad. Intentá nuevamente.");
  }

  revalidatePath("/properties");
  redirect(`/properties/${property.id}`);
}

export async function updateProperty(propertyId: string, formData: FormData) {
  await requireMembership();
  const parsed = propertySchema.safeParse(propertyFieldsFromFormData(formData));
  if (!parsed.success) {
    failUpdate(
      propertyId,
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({
      title: parsed.data.title,
      property_type: parsed.data.propertyType,
      operation_type: parsed.data.operationType,
      status: parsed.data.status,
      street: parsed.data.street ?? null,
      street_number: parsed.data.streetNumber ?? null,
      city: parsed.data.city ?? null,
      neighborhood: parsed.data.neighborhood ?? null,
      province: parsed.data.province ?? null,
      price: parsed.data.price ?? null,
      currency: parsed.data.currency ?? null,
      bedrooms: parsed.data.bedrooms ?? null,
      bathrooms: parsed.data.bathrooms ?? null,
      garage_spaces: parsed.data.garageSpaces ?? null,
      total_area: parsed.data.totalArea ?? null,
      covered_area: parsed.data.coveredArea ?? null,
      expenses: parsed.data.expenses ?? null,
      description: parsed.data.description ?? null,
    })
    .eq("id", propertyId);

  if (error) {
    console.error("Failed to update property:", error.message);
    failUpdate(
      propertyId,
      "No pudimos guardar los cambios. Intentá nuevamente.",
    );
  }

  revalidatePath("/properties");
  redirect(`/properties/${propertyId}`);
}

export async function addOwner(propertyId: string, formData: FormData) {
  await requireMembership();
  const contactId = formData.get("contactId");
  if (typeof contactId !== "string" || !contactId) return;

  const percentageRaw = formData.get("ownershipPercentage");
  const ownershipPercentage =
    typeof percentageRaw === "string" && percentageRaw !== ""
      ? Number(percentageRaw)
      : null;
  const isPrimary = formData.get("isPrimaryContact") === "on";

  const supabase = await createClient();
  const { error } = await supabase.from("property_owners").upsert({
    property_id: propertyId,
    contact_id: contactId,
    ownership_percentage: ownershipPercentage,
    is_primary_contact: isPrimary,
  });
  if (error) console.error("Failed to add property owner:", error.message);

  revalidatePath(`/properties/${propertyId}`);
}

export async function removeOwner(propertyId: string, contactId: string) {
  await requireMembership();
  const supabase = await createClient();
  const { error } = await supabase
    .from("property_owners")
    .delete()
    .eq("property_id", propertyId)
    .eq("contact_id", contactId);
  if (error) console.error("Failed to remove property owner:", error.message);

  revalidatePath(`/properties/${propertyId}`);
}

/**
 * "Registrar oferta" (V2 bloque E) — the first offer in a negotiation on
 * this property. Plain `<form action>` like `createTask`/`addOwner`
 * elsewhere on this page — logs and no-ops on invalid input rather than
 * surfacing an error, same division as the rest of this file's quick-add
 * forms (only flows with a dedicated interactive form, like the
 * counteroffer/duplicate-check ones, report errors back to the client).
 */
export async function createOffer(propertyId: string, formData: FormData) {
  const membership = await requireMembership();
  const parsed = offerSchema.safeParse({
    contactId: formData.get("contactId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    conditions: formData.get("conditions"),
    expirationDate: formData.get("expirationDate"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    console.error("Invalid offer input:", parsed.error.issues);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("offers").insert({
    organization_id: membership.organization.id,
    property_id: propertyId,
    contact_id: parsed.data.contactId,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    conditions: parsed.data.conditions ?? null,
    expiration_date: parsed.data.expirationDate || null,
    notes: parsed.data.notes ?? null,
  });
  if (error) console.error("Failed to create offer:", error.message);

  revalidatePath(`/properties/${propertyId}`);
}

/**
 * "Contraoferta" — a new row chained to the offer it responds to, never an
 * overwrite of its amount. Marks the parent `counter_offered` so the
 * thread makes it obvious which offer is still live (the newest one that
 * isn't itself countered).
 */
export async function createCounterOffer(
  parentOfferId: string,
  formData: FormData,
): Promise<{ error: string } | void> {
  const membership = await requireMembership();
  const parsed = counterOfferSchema.safeParse({
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    conditions: formData.get("conditions"),
    expirationDate: formData.get("expirationDate"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    };
  }

  const supabase = await createClient();
  const { data: parent, error: parentError } = await supabase
    .from("offers")
    .select("id, property_id, contact_id")
    .eq("id", parentOfferId)
    .single();
  if (parentError || !parent) {
    console.error("Failed to load parent offer:", parentError?.message);
    return { error: "No pudimos encontrar la oferta original." };
  }

  const { error: insertError } = await supabase.from("offers").insert({
    organization_id: membership.organization.id,
    property_id: parent.property_id,
    contact_id: parent.contact_id,
    parent_offer_id: parent.id,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    conditions: parsed.data.conditions ?? null,
    expiration_date: parsed.data.expirationDate || null,
    notes: parsed.data.notes ?? null,
  });
  if (insertError) {
    console.error("Failed to create counteroffer:", insertError.message);
    return {
      error: "No pudimos registrar la contraoferta. Intentá nuevamente.",
    };
  }

  const { error: updateError } = await supabase
    .from("offers")
    .update({ status: "counter_offered" })
    .eq("id", parent.id);
  if (updateError) {
    console.error(
      "Failed to mark parent offer as countered:",
      updateError.message,
    );
  }

  revalidatePath(`/properties/${parent.property_id}`);
}

/** Accept/reject/withdraw/expire an offer — not for "counter_offered", which is set by createCounterOffer instead. */
export async function updateOfferStatus(
  offerId: string,
  propertyId: string,
  status: string,
) {
  await requireMembership();
  if (!OFFER_STATUSES.includes(status as OfferStatus)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("offers")
    .update({ status: status as OfferStatus })
    .eq("id", offerId);
  if (error) console.error("Failed to update offer status:", error.message);

  revalidatePath(`/properties/${propertyId}`);
}

/**
 * "Oferta aceptada" → "Crear operación" (V2 bloque E): prefills the deal
 * from the offer instead of asking the advisor to retype data already on
 * hand. Links to an existing open deal on the property instead of
 * creating a second one, if there already is one.
 */
export async function acceptOfferAndCreateDeal(
  offerId: string,
): Promise<{ error: string } | void> {
  const membership = await requireMembership();
  const supabase = await createClient();

  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("id, property_id, contact_id, amount, currency")
    .eq("id", offerId)
    .single();
  if (offerError || !offer) {
    console.error("Failed to load offer to accept:", offerError?.message);
    return { error: "No pudimos encontrar la oferta." };
  }

  const existingDeal = await getOpenDealForProperty(offer.property_id);
  if (existingDeal) {
    const { error: linkError } = await supabase
      .from("offers")
      .update({ status: "accepted", deal_id: existingDeal.id })
      .eq("id", offerId);
    if (linkError) {
      console.error(
        "Failed to link offer to existing deal:",
        linkError.message,
      );
    }
    revalidatePath(`/properties/${offer.property_id}`);
    redirect(`/deals/${existingDeal.id}`);
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("operation_type")
    .eq("id", offer.property_id)
    .single();
  if (propertyError || !property) {
    console.error(
      "Failed to load property for deal creation:",
      propertyError?.message,
    );
    return { error: "No pudimos crear la operación. Intentá nuevamente." };
  }

  const { data: owners, error: ownersError } = await supabase
    .from("property_owners")
    .select("contact_id, is_primary_contact")
    .eq("property_id", offer.property_id);
  if (ownersError) {
    console.error(
      "Failed to load owners for deal creation:",
      ownersError.message,
    );
  }
  const seller = owners?.find((o) => o.is_primary_contact) ?? owners?.[0];
  if (!seller) {
    return {
      error:
        "Esta propiedad no tiene propietario cargado — agregá uno antes de crear la operación.",
    };
  }

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .insert({
      organization_id: membership.organization.id,
      property_id: offer.property_id,
      buyer_contact_id: offer.contact_id,
      seller_contact_id: seller.contact_id,
      deal_type: property.operation_type,
      agreed_price: offer.amount,
      currency: offer.currency,
      status: "offer",
    })
    .select("id")
    .single();
  if (dealError || !deal) {
    console.error("Failed to create deal from offer:", dealError?.message);
    return { error: "No pudimos crear la operación. Intentá nuevamente." };
  }

  const { error: updateError } = await supabase
    .from("offers")
    .update({ status: "accepted", deal_id: deal.id })
    .eq("id", offerId);
  if (updateError) {
    console.error(
      "Failed to link accepted offer to its new deal:",
      updateError.message,
    );
  }

  revalidatePath(`/properties/${offer.property_id}`);
  revalidatePath("/deals");
  redirect(`/deals/${deal.id}`);
}
