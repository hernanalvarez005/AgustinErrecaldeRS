"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { findPossibleDuplicates } from "@/lib/data/contacts";
import { createClient } from "@/lib/supabase/server";
import { contactSchema, parseRolesField } from "@/lib/validations/contact";

function contactFieldsFromFormData(formData: FormData) {
  return {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    email: formData.get("email"),
    dni: formData.get("dni"),
    birthDate: formData.get("birthDate"),
    address: formData.get("address"),
    profession: formData.get("profession"),
    source: formData.get("source"),
    roles: parseRolesField(formData),
  };
}

/** Used by the new/edit contact form before submitting, to warn (not block) on likely duplicates. */
export async function checkContactDuplicates(formData: FormData) {
  const membership = await requireMembership();
  const phone = formData.get("phone");
  const email = formData.get("email");
  const dni = formData.get("dni");
  const excludeId = formData.get("contactId");

  return findPossibleDuplicates({
    organizationId: membership.organization.id,
    phone: typeof phone === "string" && phone ? phone : undefined,
    email: typeof email === "string" && email ? email : undefined,
    dni: typeof dni === "string" && dni ? dni : undefined,
    excludeId:
      typeof excludeId === "string" && excludeId ? excludeId : undefined,
  });
}

export async function createContact(
  formData: FormData,
): Promise<{ error: string } | void> {
  const membership = await requireMembership();
  const parsed = contactSchema.safeParse(contactFieldsFromFormData(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    };
  }

  const supabase = await createClient();
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: membership.organization.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      email: parsed.data.email ?? null,
      dni: parsed.data.dni ?? null,
      birth_date: parsed.data.birthDate ?? null,
      address: parsed.data.address ?? null,
      profession: parsed.data.profession ?? null,
      source: parsed.data.source ?? null,
    })
    .select("id")
    .single();

  if (error || !contact) {
    console.error("Failed to create contact:", error?.message);
    return { error: "No pudimos guardar el contacto. Intentá nuevamente." };
  }

  if (parsed.data.roles.length > 0) {
    const { error: rolesError } = await supabase
      .from("contact_roles")
      .insert(
        parsed.data.roles.map((role) => ({ contact_id: contact.id, role })),
      );
    if (rolesError) {
      console.error("Failed to save contact roles:", rolesError.message);
    }
  }

  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export async function updateContact(
  contactId: string,
  formData: FormData,
): Promise<{ error: string } | void> {
  await requireMembership();
  const parsed = contactSchema.safeParse(contactFieldsFromFormData(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      email: parsed.data.email ?? null,
      dni: parsed.data.dni ?? null,
      birth_date: parsed.data.birthDate ?? null,
      address: parsed.data.address ?? null,
      profession: parsed.data.profession ?? null,
      source: parsed.data.source ?? null,
    })
    .eq("id", contactId);

  if (error) {
    console.error("Failed to update contact:", error.message);
    return { error: "No pudimos guardar los cambios. Intentá nuevamente." };
  }

  const { error: rolesDeleteError } = await supabase
    .from("contact_roles")
    .delete()
    .eq("contact_id", contactId);
  if (rolesDeleteError) {
    console.error("Failed to clear contact roles:", rolesDeleteError.message);
  }
  if (parsed.data.roles.length > 0) {
    const { error: rolesInsertError } = await supabase
      .from("contact_roles")
      .insert(
        parsed.data.roles.map((role) => ({ contact_id: contactId, role })),
      );
    if (rolesInsertError) {
      console.error("Failed to save contact roles:", rolesInsertError.message);
    }
  }

  revalidatePath("/contacts");
  redirect(`/contacts/${contactId}`);
}
