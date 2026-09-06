"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { propertySchema } from "@/lib/validations/property";

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
