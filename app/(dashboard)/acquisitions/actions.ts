"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  acquisitionSchema,
  ACQUISITION_STATUSES,
} from "@/lib/validations/acquisition";
import { valuationSchema } from "@/lib/validations/valuation";
import type { AcquisitionStatus } from "@/types/database.types";

function failCreate(message: string): never {
  redirect(`/acquisitions/new?error=${encodeURIComponent(message)}`);
}

/**
 * Creates the minimal property + ownership link + acquisition together —
 * a captación starts from "owner interested in selling", not from an
 * already-fully-entered property (see docs/PRODUCT_SPEC.md).
 */
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

  const supabase = await createClient();

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .insert({
      organization_id: membership.organization.id,
      title: parsed.data.propertyTitle,
      property_type: "other",
      operation_type: "sale",
      status: "capturing",
      city: parsed.data.city ?? null,
      neighborhood: parsed.data.neighborhood ?? null,
    })
    .select("id")
    .single();

  if (propertyError || !property) {
    console.error(
      "Failed to create property for acquisition:",
      propertyError?.message,
    );
    failCreate("No pudimos crear la captación. Intentá nuevamente.");
  }

  const { error: ownerError } = await supabase.from("property_owners").insert({
    property_id: property.id,
    contact_id: parsed.data.contactId,
    is_primary_contact: true,
  });
  if (ownerError) {
    console.error("Failed to link owner to property:", ownerError.message);
  }

  const { data: acquisition, error: acquisitionError } = await supabase
    .from("property_acquisitions")
    .insert({
      organization_id: membership.organization.id,
      property_id: property.id,
      primary_owner_contact_id: parsed.data.contactId,
      origin: parsed.data.origin ?? null,
      estimated_value: parsed.data.estimatedValue ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (acquisitionError || !acquisition) {
    console.error("Failed to create acquisition:", acquisitionError?.message);
    failCreate("No pudimos crear la captación. Intentá nuevamente.");
  }

  revalidatePath("/acquisitions");
  redirect(`/acquisitions/${acquisition.id}`);
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
  if (!parsed.success) return;

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
