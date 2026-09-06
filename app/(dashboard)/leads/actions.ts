"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { findPossibleDuplicates } from "@/lib/data/contacts";
import { createClient } from "@/lib/supabase/server";
import { CONTACT_SOURCES } from "@/lib/validations/contact";
import { leadSchema, LEAD_STATUSES } from "@/lib/validations/lead";
import type { ContactSource, LeadStatus } from "@/types/database.types";

function leadFieldsFromFormData(formData: FormData) {
  // "none" is the LeadForm's explicit sentinel for "no property" — a real
  // SelectItem, not an unset placeholder, so the property Select always has
  // at least two items (see components/leads/lead-form.tsx and the Base UI
  // single-item Select gotcha in docs/ARCHITECTURE.md). Normalize it to ""
  // here so leadSchema's emptyToUndefined treats it as absent.
  const propertyId = formData.get("propertyId");
  return {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    message: formData.get("message"),
    source: formData.get("source"),
    propertyId: propertyId === "none" ? "" : propertyId,
    notes: formData.get("notes"),
  };
}

function failCreate(message: string): never {
  redirect(`/leads/new?error=${encodeURIComponent(message)}`);
}

function failUpdate(leadId: string, message: string): never {
  redirect(`/leads/${leadId}/edit?error=${encodeURIComponent(message)}`);
}

export async function createLead(formData: FormData) {
  const membership = await requireMembership();
  const parsed = leadSchema.safeParse(leadFieldsFromFormData(formData));
  if (!parsed.success) {
    console.error("Invalid lead input:", parsed.error.issues);
    failCreate(
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      organization_id: membership.organization.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      message: parsed.data.message ?? null,
      source: parsed.data.source ?? null,
      property_id: parsed.data.propertyId ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    console.error("Failed to create lead:", error?.message);
    failCreate("No pudimos guardar el lead. Intentá nuevamente.");
  }

  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLead(leadId: string, formData: FormData) {
  await requireMembership();
  const parsed = leadSchema.safeParse(leadFieldsFromFormData(formData));
  if (!parsed.success) {
    console.error("Invalid lead input:", parsed.error.issues);
    failUpdate(
      leadId,
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      message: parsed.data.message ?? null,
      source: parsed.data.source ?? null,
      property_id: parsed.data.propertyId ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", leadId);

  if (error) {
    console.error("Failed to update lead:", error.message);
    failUpdate(leadId, "No pudimos guardar los cambios. Intentá nuevamente.");
  }

  revalidatePath("/leads");
  redirect(`/leads/${leadId}`);
}

export async function updateLeadStatus(leadId: string, formData: FormData) {
  await requireMembership();
  const statusValue = formData.get("status");
  if (
    typeof statusValue !== "string" ||
    !LEAD_STATUSES.includes(statusValue as LeadStatus)
  )
    return;
  const status = statusValue as LeadStatus;

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", leadId);
  if (error) console.error("Failed to update lead status:", error.message);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

/**
 * Used by the conversion form before creating a contact, to warn on likely
 * duplicates — same underlying check as the contact form
 * (checkContactDuplicates), reused here so converting a lead never creates
 * a duplicate contact (docs/PRODUCT_SPEC.md regla de negocio 6).
 */
export async function checkLeadDuplicates(formData: FormData) {
  const membership = await requireMembership();
  const phone = formData.get("phone");
  const email = formData.get("email");

  return findPossibleDuplicates({
    organizationId: membership.organization.id,
    phone: typeof phone === "string" && phone ? phone : undefined,
    email: typeof email === "string" && email ? email : undefined,
  });
}

/** Links a lead to a contact that already exists — no new contact created. */
export async function convertLeadToExistingContact(
  leadId: string,
  contactId: string,
) {
  await requireMembership();
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      contact_id: contactId,
      status: "converted",
      converted_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    console.error("Failed to link lead to existing contact:", error.message);
    failUpdate(leadId, "No pudimos vincular el contacto. Intentá nuevamente.");
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  redirect(`/searches/new?contactId=${contactId}&leadId=${leadId}`);
}

/**
 * Creates a brand-new contact from the (possibly corrected) lead fields and
 * links it. Callers are expected to have already run checkLeadDuplicates
 * and let the advisor confirm — this action itself does not re-check, same
 * "warn, never hard-block" division of responsibility as contacts/actions.ts.
 */
export async function convertLeadToNewContact(
  leadId: string,
  formData: FormData,
): Promise<{ error: string } | void> {
  const membership = await requireMembership();
  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  if (typeof firstName !== "string" || !firstName.trim()) {
    return { error: "Ingresá el nombre." };
  }
  if (typeof lastName !== "string" || !lastName.trim()) {
    return { error: "Ingresá el apellido." };
  }
  const phone = formData.get("phone");
  const email = formData.get("email");
  const sourceRaw = formData.get("source");
  const source =
    typeof sourceRaw === "string" &&
    CONTACT_SOURCES.includes(sourceRaw as ContactSource)
      ? (sourceRaw as ContactSource)
      : null;

  const supabase = await createClient();
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: membership.organization.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: typeof phone === "string" && phone ? phone : null,
      email: typeof email === "string" && email ? email : null,
      source,
    })
    .select("id")
    .single();

  if (error || !contact) {
    console.error("Failed to create contact from lead:", error?.message);
    return { error: "No pudimos crear el contacto. Intentá nuevamente." };
  }

  const { error: leadError } = await supabase
    .from("leads")
    .update({
      contact_id: contact.id,
      status: "converted",
      converted_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (leadError) {
    console.error("Failed to link new contact to lead:", leadError.message);
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/contacts");
  redirect(`/searches/new?contactId=${contact.id}&leadId=${leadId}`);
}
