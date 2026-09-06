import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OperationType, PropertyStatus } from "@/types/database.types";

export async function listProperties({
  organizationId,
  search,
  status,
  operationType,
}: {
  organizationId: string;
  search?: string;
  status?: PropertyStatus;
  operationType?: OperationType;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("property_overview")
    .select(
      "id, title, property_type, operation_type, city, neighborhood, price, currency, status, primary_owner_name",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (search) {
    const term = `%${search}%`;
    query = query.or(
      `title.ilike.${term},city.ilike.${term},neighborhood.ilike.${term}`,
    );
  }
  if (status) query = query.eq("status", status);
  if (operationType) query = query.eq("operation_type", operationType);

  const { data, error } = await query.limit(200);
  if (error) {
    console.error("Failed to list properties:", error.message);
    return [];
  }
  return data;
}

export async function getProperty(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to load property:", error.message);
    return null;
  }
  return data;
}

export async function getPropertyOwners(propertyId: string) {
  const supabase = await createClient();
  const { data: owners, error } = await supabase
    .from("property_owners")
    .select("contact_id, ownership_percentage, is_primary_contact")
    .eq("property_id", propertyId)
    .order("is_primary_contact", { ascending: false });

  if (error) {
    console.error("Failed to load property owners:", error.message);
    return [];
  }
  if (owners.length === 0) return [];

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, phone, email")
    .in(
      "id",
      owners.map((o) => o.contact_id),
    );

  if (contactsError) {
    console.error("Failed to load owner contacts:", contactsError.message);
    return [];
  }

  const byId = new Map(contacts.map((c) => [c.id, c]));
  return owners
    .map((owner) => {
      const contact = byId.get(owner.contact_id);
      if (!contact) return null;
      return { ...owner, contact };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);
}

/** Every contact in the org, for the "add owner" picker. Cheap while contact volume is small (MVP). */
export async function listContactOptions(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("first_name", { ascending: true });

  if (error) {
    console.error("Failed to list contacts for owner picker:", error.message);
    return [];
  }
  return data;
}
