"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { findPossibleDuplicates } from "@/lib/data/contacts";
import { createClient } from "@/lib/supabase/server";
import {
  acquisitionSchema,
  quickAcquisitionSchema,
  ACQUISITION_STATUSES,
} from "@/lib/validations/acquisition";
import { valuationSchema } from "@/lib/validations/valuation";
import type {
  AcquisitionStatus,
  ContactSource,
  PropertyType,
} from "@/types/database.types";

function failCreate(message: string): never {
  redirect(`/acquisitions/new?error=${encodeURIComponent(message)}`);
}

type AcquisitionRecordFields = {
  propertyTitle: string;
  propertyType?: PropertyType;
  city?: string;
  neighborhood?: string;
  origin?: ContactSource;
  estimatedValue?: number;
  notes?: string;
};

/**
 * Creates the minimal property + ownership link + acquisition together —
 * a captación starts from "owner interested in selling", not from an
 * already-fully-entered property (see docs/PRODUCT_SPEC.md). Shared by
 * every entry point that can produce a captación (the full form below,
 * and both branches of "captación rápida" — V2 bloque B) so there is only
 * ever one place that writes these three rows, never two parallel paths.
 * Returns `null` on failure instead of redirecting itself — each caller
 * knows where its own form lives and redirects accordingly.
 */
async function insertAcquisitionRecord(
  organizationId: string,
  contactId: string,
  fields: AcquisitionRecordFields,
): Promise<{ id: string } | null> {
  const supabase = await createClient();

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .insert({
      organization_id: organizationId,
      title: fields.propertyTitle,
      property_type: fields.propertyType ?? "other",
      operation_type: "sale",
      status: "capturing",
      city: fields.city ?? null,
      neighborhood: fields.neighborhood ?? null,
    })
    .select("id")
    .single();

  if (propertyError || !property) {
    console.error(
      "Failed to create property for acquisition:",
      propertyError?.message,
    );
    return null;
  }

  const { error: ownerError } = await supabase.from("property_owners").insert({
    property_id: property.id,
    contact_id: contactId,
    is_primary_contact: true,
  });
  if (ownerError) {
    console.error("Failed to link owner to property:", ownerError.message);
  }

  const { data: acquisition, error: acquisitionError } = await supabase
    .from("property_acquisitions")
    .insert({
      organization_id: organizationId,
      property_id: property.id,
      primary_owner_contact_id: contactId,
      origin: fields.origin ?? null,
      estimated_value: fields.estimatedValue ?? null,
      notes: fields.notes ?? null,
    })
    .select("id")
    .single();

  if (acquisitionError || !acquisition) {
    console.error("Failed to create acquisition:", acquisitionError?.message);
    return null;
  }

  return acquisition;
}

export async function createAcquisition(formData: FormData) {
  const membership = await requireMembership();
  const parsed = acquisitionSchema.safeParse({
    contactId: formData.get("contactId"),
    propertyTitle: formData.get("propertyTitle"),
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood"),
    origin: formData.get("origin"),
    estimatedValue: formData.get("estimatedValue"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    failCreate(
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const acquisition = await insertAcquisitionRecord(
    membership.organization.id,
    parsed.data.contactId,
    {
      propertyTitle: parsed.data.propertyTitle,
      city: parsed.data.city,
      neighborhood: parsed.data.neighborhood,
      origin: parsed.data.origin,
      estimatedValue: parsed.data.estimatedValue,
      notes: parsed.data.notes,
    },
  );
  if (!acquisition) {
    failCreate("No pudimos crear la captación. Intentá nuevamente.");
  }

  revalidatePath("/acquisitions");
  redirect(`/acquisitions/${acquisition.id}`);
}

function quickAcquisitionFieldsFromFormData(formData: FormData) {
  return {
    ownerFirstName: formData.get("ownerFirstName"),
    ownerLastName: formData.get("ownerLastName"),
    ownerPhone: formData.get("ownerPhone"),
    addressReference: formData.get("addressReference"),
    propertyType: formData.get("propertyType"),
    estimatedValue: formData.get("estimatedValue"),
    origin: formData.get("origin"),
    notes: formData.get("notes"),
  };
}

/**
 * Used by the "captación rápida" form before creating a contact, to warn
 * on likely duplicates — same underlying check as the contact form and
 * lead conversion (checkLeadDuplicates), reused here so a quick captación
 * never creates a duplicate owner (docs/PRODUCT_SPEC.md regla 6).
 */
export async function checkAcquisitionOwnerDuplicates(formData: FormData) {
  const membership = await requireMembership();
  const phone = formData.get("ownerPhone");
  return findPossibleDuplicates({
    organizationId: membership.organization.id,
    phone: typeof phone === "string" && phone ? phone : undefined,
  });
}

/**
 * "Captación rápida" — creates a brand-new owner contact from the form and
 * links it. Callers are expected to have already run
 * checkAcquisitionOwnerDuplicates and let the advisor confirm — this
 * action itself does not re-check, same "warn, never hard-block" division
 * of responsibility as convertLeadToNewContact.
 */
export async function createQuickAcquisition(
  formData: FormData,
): Promise<{ error: string } | void> {
  const membership = await requireMembership();
  const parsed = quickAcquisitionSchema.safeParse(
    quickAcquisitionFieldsFromFormData(formData),
  );
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    };
  }

  const supabase = await createClient();
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      organization_id: membership.organization.id,
      first_name: parsed.data.ownerFirstName,
      last_name: parsed.data.ownerLastName,
      phone: parsed.data.ownerPhone ?? null,
      source: parsed.data.origin ?? null,
    })
    .select("id")
    .single();
  if (contactError || !contact) {
    console.error(
      "Failed to create owner contact for quick acquisition:",
      contactError?.message,
    );
    return { error: "No pudimos crear el contacto. Intentá nuevamente." };
  }

  const acquisition = await insertAcquisitionRecord(
    membership.organization.id,
    contact.id,
    {
      propertyTitle: parsed.data.addressReference,
      propertyType: parsed.data.propertyType,
      origin: parsed.data.origin,
      estimatedValue: parsed.data.estimatedValue,
      notes: parsed.data.notes,
    },
  );
  if (!acquisition) {
    return { error: "No pudimos crear la captación. Intentá nuevamente." };
  }

  revalidatePath("/acquisitions");
  redirect(`/acquisitions/${acquisition.id}?created=1`);
}

/** "Captación rápida", rama "usar este contacto" — mismos campos, sin crear un contacto nuevo. */
export async function createQuickAcquisitionForExistingOwner(
  contactId: string,
  formData: FormData,
): Promise<{ error: string } | void> {
  const membership = await requireMembership();
  const parsed = quickAcquisitionSchema.safeParse(
    quickAcquisitionFieldsFromFormData(formData),
  );
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    };
  }

  const acquisition = await insertAcquisitionRecord(
    membership.organization.id,
    contactId,
    {
      propertyTitle: parsed.data.addressReference,
      propertyType: parsed.data.propertyType,
      origin: parsed.data.origin,
      estimatedValue: parsed.data.estimatedValue,
      notes: parsed.data.notes,
    },
  );
  if (!acquisition) {
    return { error: "No pudimos crear la captación. Intentá nuevamente." };
  }

  revalidatePath("/acquisitions");
  redirect(`/acquisitions/${acquisition.id}?created=1`);
}

export async function updateAcquisitionStatus(
  acquisitionId: string,
  status: string,
) {
  await requireMembership();
  if (!ACQUISITION_STATUSES.includes(status as AcquisitionStatus)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("property_acquisitions")
    .update({ status: status as AcquisitionStatus })
    .eq("id", acquisitionId);

  if (error)
    console.error("Failed to update acquisition status:", error.message);

  revalidatePath("/acquisitions");
  revalidatePath(`/acquisitions/${acquisitionId}`);
}

export async function markAcquisitionLost(
  acquisitionId: string,
  formData: FormData,
) {
  await requireMembership();
  const reason = formData.get("lostReason");

  const supabase = await createClient();
  const { error } = await supabase
    .from("property_acquisitions")
    .update({
      status: "lost",
      lost_reason: typeof reason === "string" && reason ? reason : null,
    })
    .eq("id", acquisitionId);

  if (error) console.error("Failed to mark acquisition lost:", error.message);

  revalidatePath("/acquisitions");
  revalidatePath(`/acquisitions/${acquisitionId}`);
}

export async function createValuation(
  propertyId: string,
  acquisitionId: string,
  formData: FormData,
) {
  const membership = await requireMembership();
  const parsed = valuationSchema.safeParse({
    estimatedMinValue: formData.get("estimatedMinValue"),
    estimatedValue: formData.get("estimatedValue"),
    estimatedMaxValue: formData.get("estimatedMaxValue"),
    currency: formData.get("currency"),
    recommendedListingPrice: formData.get("recommendedListingPrice"),
    valuationDate: formData.get("valuationDate"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    console.error("Invalid valuation input:", parsed.error.issues);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("valuations").insert({
    organization_id: membership.organization.id,
    property_id: propertyId,
    acquisition_id: acquisitionId,
    estimated_min_value: parsed.data.estimatedMinValue ?? null,
    estimated_value: parsed.data.estimatedValue ?? null,
    estimated_max_value: parsed.data.estimatedMaxValue ?? null,
    currency: parsed.data.currency ?? null,
    recommended_listing_price: parsed.data.recommendedListingPrice ?? null,
    valuation_date: parsed.data.valuationDate || undefined,
    notes: parsed.data.notes ?? null,
  });
  if (error) console.error("Failed to create valuation:", error.message);

  revalidatePath(`/acquisitions/${acquisitionId}`);
}
