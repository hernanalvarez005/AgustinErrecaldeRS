import "server-only";

import {
  getBusinessTodayBoundsUtc,
  getDateOnlyTodayBoundsUtc,
} from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { ActivityType } from "@/types/database.types";

export type TodayLink = { href: string; label: string };

type EngagementRefs = {
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
 * a working link + a human label, for the "Hoy" dashboard where items from
 * every entity type show up mixed together. Everything on /today must be
 * clickable (docs/PRODUCT_SPEC.md, "Experiencia diaria esperada") — this
 * used to only resolve contact_id and silently produced a dead `href="#"`
 * for any task/activity attached to a property/acquisition/search/lead/deal,
 * which is every task created from Fases 2-6 onward. Batches lookups (not
 * per-row) the same way lib/data/acquisitions.ts and lib/data/deals.ts do.
 */
async function resolveEngagementLinks<T extends EngagementRefs>(
  items: T[],
): Promise<(T & { link: TodayLink | null })[]> {
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

  function resolve(item: T): TodayLink | null {
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

export type TodayTask = {
  id: string;
  title: string;
  due_at: string | null;
  priority: string;
  link: TodayLink | null;
};

const TASK_REF_COLUMNS =
  "id, title, due_at, priority, contact_id, property_id, acquisition_id, search_id, lead_id, deal_id";

/** Pending/in-progress tasks due today (Argentina calendar day). */
export async function listTasksDueToday(
  organizationId: string,
): Promise<TodayTask[]> {
  const { startUtc, endUtc } = getDateOnlyTodayBoundsUtc();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_REF_COLUMNS)
    .eq("organization_id", organizationId)
    .in("status", ["pending", "in_progress"])
    .gte("due_at", startUtc)
    .lt("due_at", endUtc)
    .order("due_at", { ascending: true });

  if (error) {
    console.error("Failed to load today's tasks:", error.message);
    return [];
  }
  return resolveEngagementLinks(data);
}

/** Pending/in-progress tasks whose due date has already passed (Argentina calendar day). */
export async function listOverdueTasks(
  organizationId: string,
): Promise<TodayTask[]> {
  const { startUtc } = getDateOnlyTodayBoundsUtc();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_REF_COLUMNS)
    .eq("organization_id", organizationId)
    .in("status", ["pending", "in_progress"])
    .lt("due_at", startUtc)
    .order("due_at", { ascending: true });

  if (error) {
    console.error("Failed to load overdue tasks:", error.message);
    return [];
  }
  return resolveEngagementLinks(data);
}

export type TodayActivity = {
  id: string;
  type: ActivityType;
  description: string | null;
  starts_at: string;
  link: TodayLink | null;
};

/** Scheduled activities (calls, meetings, visits...) happening today. Populated once Fase 8 adds a way to schedule them ahead of time. */
export async function listTodayActivities(
  organizationId: string,
): Promise<TodayActivity[]> {
  const { startUtc, endUtc } = getBusinessTodayBoundsUtc();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, type, description, starts_at, contact_id, property_id, acquisition_id, search_id, lead_id, deal_id",
    )
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .gte("starts_at", startUtc)
    .lt("starts_at", endUtc)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("Failed to load today's activities:", error.message);
    return [];
  }
  return resolveEngagementLinks(data);
}

export type CommercialAlert = { count: number; label: string; href: string };

function pluralAlert(
  count: number,
  singular: string,
  plural: string,
  href: string,
): CommercialAlert {
  return { count, label: count === 1 ? singular : plural, href };
}

/**
 * Surfaces violations of docs/PRODUCT_SPEC.md regla de negocio 5: "una
 * oportunidad activa (captación, búsqueda, operación) debería mostrar
 * siempre una próxima acción". Counts, per entity, how many active ones
 * have no pending task (next_action_at is null on the *_overview views).
 */
export async function listCommercialAlerts(
  organizationId: string,
): Promise<CommercialAlert[]> {
  const supabase = await createClient();

  const [searches, acquisitions, deals] = await Promise.all([
    supabase
      .from("search_overview")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("status", "in", "(closed,lost)")
      .is("next_action_at", null),
    supabase
      .from("acquisition_overview")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("status", "in", "(won,lost)")
      .is("next_action_at", null),
    supabase
      .from("deal_overview")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("status", "in", "(closed,cancelled)")
      .is("next_action_at", null),
  ]);

  if (searches.error)
    console.error("Failed to count search alerts:", searches.error.message);
  if (acquisitions.error)
    console.error(
      "Failed to count acquisition alerts:",
      acquisitions.error.message,
    );
  if (deals.error)
    console.error("Failed to count deal alerts:", deals.error.message);

  const alerts: CommercialAlert[] = [];
  const searchCount = searches.count ?? 0;
  const acquisitionCount = acquisitions.count ?? 0;
  const dealCount = deals.count ?? 0;

  if (searchCount > 0) {
    alerts.push(
      pluralAlert(
        searchCount,
        `${searchCount} búsqueda activa sin próxima acción`,
        `${searchCount} búsquedas activas sin próxima acción`,
        "/searches",
      ),
    );
  }
  if (acquisitionCount > 0) {
    alerts.push(
      pluralAlert(
        acquisitionCount,
        `${acquisitionCount} captación activa sin próxima acción`,
        `${acquisitionCount} captaciones activas sin próxima acción`,
        "/acquisitions",
      ),
    );
  }
  if (dealCount > 0) {
    alerts.push(
      pluralAlert(
        dealCount,
        `${dealCount} operación activa sin próxima acción`,
        `${dealCount} operaciones activas sin próxima acción`,
        "/deals",
      ),
    );
  }

  return alerts;
}
