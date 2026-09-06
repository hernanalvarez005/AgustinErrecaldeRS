import "server-only";

import { createClient } from "@/lib/supabase/server";

export type EngagementLink = { href: string; label: string };

export type EngagementRefs = {
  contact_id: string | null;
  property_id: string | null;
  acquisition_id: string | null;
  search_id: string | null;
  lead_id: string | null;
  deal_id: string | null;
};

/**
 * Resolves the one entity a task/activity is attached to (exactly one of
 * contact/property/acquisition/search/lead/deal — see docs/DATABASE.md) into
 * a working link + a human label. Used anywhere items from every entity
 * type show up mixed together (the "Hoy" dashboard, the calendar) where
 * everything must be clickable (docs/PRODUCT_SPEC.md, "Experiencia diaria
 * esperada") — earlier code (Fase 0-7) only resolved contact_id and
 * silently produced a dead `href="#"` for any task/activity attached to a
 * property/acquisition/search/lead/deal, which is every task created from
 * Fases 2-6 onward (fixed in Fase 7, see docs/ARCHITECTURE.md). Batches
 * lookups (not per-row), same "avoid N+1" approach as
 * lib/data/acquisitions.ts and lib/data/deals.ts.
 */
export async function resolveEngagementLinks<T extends EngagementRefs>(
  items: T[],
): Promise<(T & { link: EngagementLink | null })[]> {
  const supabase = await createClient();

  const acquisitionIds = [
    ...new Set(
      items.map((i) => i.acquisition_id).filter((v): v is string => Boolean(v)),
    ),
  ];
  const dealIds = [
    ...new Set(
      items.map((i) => i.deal_id).filter((v): v is string => Boolean(v)),
    ),
  ];
  const searchIds = [
    ...new Set(
      items.map((i) => i.search_id).filter((v): v is string => Boolean(v)),
    ),
  ];

  // acquisitions/deals/searches are one hop away from what's actually worth
  // showing (a property title or a contact name) — resolve that hop first so
  // the second batch of lookups can include the properties/contacts they need.
  const [acquisitionsRes, dealsRes, searchesRes] = await Promise.all([
    acquisitionIds.length
      ? supabase
          .from("property_acquisitions")
          .select("id, property_id")
          .in("id", acquisitionIds)
      : Promise.resolve({ data: [] as { id: string; property_id: string }[] }),
    dealIds.length
      ? supabase.from("deals").select("id, property_id").in("id", dealIds)
      : Promise.resolve({ data: [] as { id: string; property_id: string }[] }),
    searchIds.length
      ? supabase
          .from("property_searches")
          .select("id, contact_id")
          .in("id", searchIds)
      : Promise.resolve({ data: [] as { id: string; contact_id: string }[] }),
  ]);

  const acquisitionPropertyId = new Map(
    (acquisitionsRes.data ?? []).map((a) => [a.id, a.property_id]),
  );
  const dealPropertyId = new Map(
    (dealsRes.data ?? []).map((d) => [d.id, d.property_id]),
  );
  const searchContactId = new Map(
    (searchesRes.data ?? []).map((s) => [s.id, s.contact_id]),
  );

  const contactIds = new Set<string>();
  const propertyIds = new Set<string>();
  const leadIds = new Set<string>();

  for (const item of items) {
    if (item.contact_id) contactIds.add(item.contact_id);
    if (item.property_id) propertyIds.add(item.property_id);
    if (item.lead_id) leadIds.add(item.lead_id);
    if (item.acquisition_id) {
      const pid = acquisitionPropertyId.get(item.acquisition_id);
      if (pid) propertyIds.add(pid);
    }
    if (item.deal_id) {
      const pid = dealPropertyId.get(item.deal_id);
      if (pid) propertyIds.add(pid);
    }
    if (item.search_id) {
      const cid = searchContactId.get(item.search_id);
      if (cid) contactIds.add(cid);
    }
  }

  const [contactsRes, propertiesRes, leadsRes] = await Promise.all([
    contactIds.size
      ? supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .in("id", [...contactIds])
      : Promise.resolve({
          data: [] as { id: string; first_name: string; last_name: string }[],
        }),
    propertyIds.size
      ? supabase
          .from("properties")
          .select("id, title")
          .in("id", [...propertyIds])
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    leadIds.size
      ? supabase
          .from("leads")
          .select("id, first_name, last_name")
          .in("id", [...leadIds])
      : Promise.resolve({
          data: [] as {
            id: string;
            first_name: string;
            last_name: string | null;
          }[],
        }),
  ]);

  const contactById = new Map((contactsRes.data ?? []).map((c) => [c.id, c]));
  const propertyById = new Map(
    (propertiesRes.data ?? []).map((p) => [p.id, p]),
  );
  const leadById = new Map((leadsRes.data ?? []).map((l) => [l.id, l]));

  function resolve(item: T): EngagementLink | null {
    if (item.contact_id) {
      const c = contactById.get(item.contact_id);
      return c
        ? {
            href: `/contacts/${item.contact_id}`,
            label: `${c.first_name} ${c.last_name}`,
          }
        : null;
    }
    if (item.property_id) {
      const p = propertyById.get(item.property_id);
      return p
        ? { href: `/properties/${item.property_id}`, label: p.title }
        : null;
    }
    if (item.search_id) {
      const cid = searchContactId.get(item.search_id);
      const c = cid ? contactById.get(cid) : null;
      return {
        href: `/searches/${item.search_id}`,
        label: c ? `Búsqueda de ${c.first_name} ${c.last_name}` : "Búsqueda",
      };
    }
    if (item.acquisition_id) {
      const pid = acquisitionPropertyId.get(item.acquisition_id);
      const p = pid ? propertyById.get(pid) : null;
      return {
        href: `/acquisitions/${item.acquisition_id}`,
        label: p ? `Captación: ${p.title}` : "Captación",
      };
    }
    if (item.lead_id) {
      const l = leadById.get(item.lead_id);
      return l
        ? {
            href: `/leads/${item.lead_id}`,
            label: `${l.first_name} ${l.last_name ?? ""}`.trim(),
          }
        : null;
    }
    if (item.deal_id) {
      const pid = dealPropertyId.get(item.deal_id);
      const p = pid ? propertyById.get(pid) : null;
      return {
        href: `/deals/${item.deal_id}`,
        label: p ? `Operación: ${p.title}` : "Operación",
      };
    }
    return null;
  }

  return items.map((item) => ({ ...item, link: resolve(item) }));
}
