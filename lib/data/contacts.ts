import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ContactRole } from "@/types/database.types";

export async function listContacts({
  organizationId,
  search,
  role,
}: {
  organizationId: string;
  search?: string;
  role?: ContactRole;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("contact_overview")
    .select(
      "id, first_name, last_name, phone, email, roles, last_interaction_at, next_action_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (search) {
    const term = `%${search}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`,
    );
  }

  if (role) {
    query = query.contains("roles", [role]);
  }

  const { data, error } = await query.limit(200);
  if (error) {
    console.error("Failed to list contacts:", error.message);
    return [];
  }
  return data;
}

export async function getContact(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to load contact:", error.message);
    return null;
  }
  return data;
}

export async function getContactRoles(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_roles")
    .select("role")
    .eq("contact_id", contactId);
  if (error) {
    console.error("Failed to load contact roles:", error.message);
    return [];
  }
  return data.map((row) => row.role);
}

/**
 * Looks for existing contacts that share a phone, email, or DNI with the
 * given input — used to warn before creating a likely duplicate (never to
 * hard-block, per docs/PRODUCT_SPEC.md).
 */
export async function findPossibleDuplicates({
  organizationId,
  phone,
  email,
  dni,
  excludeId,
}: {
  organizationId: string;
  phone?: string;
  email?: string;
  dni?: string;
  excludeId?: string;
}) {
  const filters = [
    phone ? `phone.eq.${phone}` : null,
    email ? `email.eq.${email}` : null,
    dni ? `dni.eq.${dni}` : null,
  ].filter((clause): clause is string => Boolean(clause));

  if (filters.length === 0) return [];

  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, phone, email, dni")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .or(filters.join(","))
    .limit(5);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to search duplicate contacts:", error.message);
    return [];
  }
  return data;
}
