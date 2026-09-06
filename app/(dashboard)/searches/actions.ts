"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  parseListField,
  searchSchema,
  SEARCH_STATUSES,
} from "@/lib/validations/search";
import type { SearchStatus } from "@/types/database.types";

function searchFieldsFromFormData(formData: FormData) {
  return {
    contactId: formData.get("contactId"),
    operationType: formData.get("operationType") || undefined,
    propertyTypes: formData.getAll("propertyTypes"),
    minPrice: formData.get("minPrice"),
    maxPrice: formData.get("maxPrice"),
    currency: formData.get("currency"),
    cities: parseListField(formData.get("cities")),
    neighborhoods: parseListField(formData.get("neighborhoods")),
    minBedrooms: formData.get("minBedrooms"),
    maxBedrooms: formData.get("maxBedrooms"),
    objective: formData.get("objective"),
    urgency: formData.get("urgency"),
    financingRequired: formData.get("financingRequired") === "on",
    status: formData.get("status") || undefined,
    notes: formData.get("notes"),
  };
}

function failCreate(message: string): never {
  redirect(`/searches/new?error=${encodeURIComponent(message)}`);
}

function failUpdate(searchId: string, message: string): never {
  redirect(`/searches/${searchId}/edit?error=${encodeURIComponent(message)}`);
}

export async function createSearch(formData: FormData) {
  const membership = await requireMembership();
  const parsed = searchSchema.safeParse(searchFieldsFromFormData(formData));
  if (!parsed.success) {
    console.error("Invalid search input:", parsed.error.issues);
    failCreate(
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const supabase = await createClient();
  const { data: search, error } = await supabase
    .from("property_searches")
    .insert({
      organization_id: membership.organization.id,
      contact_id: parsed.data.contactId,
      operation_type: parsed.data.operationType,
      property_types: parsed.data.propertyTypes,
      min_price: parsed.data.minPrice ?? null,
      max_price: parsed.data.maxPrice ?? null,
      currency: parsed.data.currency ?? null,
      cities: parsed.data.cities,
      neighborhoods: parsed.data.neighborhoods,
      min_bedrooms: parsed.data.minBedrooms ?? null,
      max_bedrooms: parsed.data.maxBedrooms ?? null,
      objective: parsed.data.objective ?? null,
      urgency: parsed.data.urgency ?? null,
      financing_required: parsed.data.financingRequired,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !search) {
    console.error("Failed to create search:", error?.message);
    failCreate("No pudimos guardar la búsqueda. Intentá nuevamente.");
  }

  revalidatePath("/searches");
  redirect(`/searches/${search.id}`);
}

export async function updateSearch(searchId: string, formData: FormData) {
  await requireMembership();
  const parsed = searchSchema.safeParse(searchFieldsFromFormData(formData));
  if (!parsed.success) {
    console.error("Invalid search input:", parsed.error.issues);
    failUpdate(
      searchId,
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("property_searches")
    .update({
      operation_type: parsed.data.operationType,
      property_types: parsed.data.propertyTypes,
      min_price: parsed.data.minPrice ?? null,
      max_price: parsed.data.maxPrice ?? null,
      currency: parsed.data.currency ?? null,
      cities: parsed.data.cities,
      neighborhoods: parsed.data.neighborhoods,
      min_bedrooms: parsed.data.minBedrooms ?? null,
      max_bedrooms: parsed.data.maxBedrooms ?? null,
      objective: parsed.data.objective ?? null,
      urgency: parsed.data.urgency ?? null,
      financing_required: parsed.data.financingRequired,
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", searchId);

  if (error) {
    console.error("Failed to update search:", error.message);
    failUpdate(searchId, "No pudimos guardar los cambios. Intentá nuevamente.");
  }

  revalidatePath("/searches");
  redirect(`/searches/${searchId}`);
}

export async function updateSearchStatus(searchId: string, formData: FormData) {
  await requireMembership();
  const statusValue = formData.get("status");
  if (
    typeof statusValue !== "string" ||
    !SEARCH_STATUSES.includes(statusValue as SearchStatus)
  )
    return;
  const status = statusValue as SearchStatus;

  const supabase = await createClient();
  const { error } = await supabase
    .from("property_searches")
    .update({ status })
    .eq("id", searchId);
  if (error) console.error("Failed to update search status:", error.message);

  revalidatePath("/searches");
  revalidatePath(`/searches/${searchId}`);
}
