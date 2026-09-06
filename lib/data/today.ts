import "server-only";

import { getBusinessDayBoundsUtc, getDateOnlyTodayBoundsUtc } from "@/lib/date";
import {
  resolveEngagementLinks,
  type EngagementLink,
  type EngagementRefs,
} from "@/lib/data/engagement-links";
import { toWhatsAppLink } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityStatus,
  ActivityType,
  ContactSource,
  DealStatus,
} from "@/types/database.types";

export type TodayLink = EngagementLink;

export type TodayTask = EngagementRefs & {
  id: string;
  title: string;
  due_at: string | null;
  priority: string;
  link: TodayLink | null;
  whatsappHref: string | null;
};

const TASK_REF_COLUMNS =
  "id, title, due_at, priority, contact_id, property_id, acquisition_id, search_id, lead_id, deal_id";

/**
 * Adds a `wa.me` link for tasks tied directly to a contact with a phone
 * number — the "WhatsApp" quick action on Today's seguimiento lists (V2
 * bloque A). Only resolves the DIRECT `contact_id` (not one derived via
 * search_id, the way `resolveEngagementLinks` does for its `link`) to keep
 * this additive and not touch that shared resolver's contract.
 */
async function attachWhatsAppLinks<
  T extends EngagementRefs & { link: TodayLink | null },
>(items: T[]): Promise<(T & { whatsappHref: string | null })[]> {
  const contactIds = [
    ...new Set(
      items.map((i) => i.contact_id).filter((v): v is string => Boolean(v)),
    ),
  ];
  if (contactIds.length === 0) {
    return items.map((item) => ({ ...item, whatsappHref: null }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, phone, whatsapp")
    .in("id", contactIds);
  if (error) {
    console.error(
      "Failed to load contact phones for WhatsApp links:",
      error.message,
    );
    return items.map((item) => ({ ...item, whatsappHref: null }));
  }

  const phoneByContact = new Map(
    data.map((c) => [c.id, c.whatsapp || c.phone]),
  );
  return items.map((item) => {
    const phone = item.contact_id ? phoneByContact.get(item.contact_id) : null;
    return { ...item, whatsappHref: phone ? toWhatsAppLink(phone) : null };
  });
}

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
  return attachWhatsAppLinks(await resolveEngagementLinks(data));
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
  return attachWhatsAppLinks(await resolveEngagementLinks(data));
}

export type TodayActivity = {
  id: string;
  type: ActivityType;
  description: string | null;
  starts_at: string;
  status: ActivityStatus;
  link: TodayLink | null;
};

/** Scheduled activities (calls, meetings, visits...) happening today. */
export async function listTodayActivities(
  organizationId: string,
): Promise<TodayActivity[]> {
  const { startUtc, endUtc } = getBusinessDayBoundsUtc();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, type, description, starts_at, status, contact_id, property_id, acquisition_id, search_id, lead_id, deal_id",
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

export type TodayLead = {
  id: string;
  name: string;
  source: ContactSource | null;
  message: string | null;
  created_at: string;
  property_title: string | null;
};

/**
 * The oldest-first `new` leads — nobody has responded yet. Ordered ascending
 * (longest-waiting first) per docs/V2_EVOLUTION_PLAN.md bloque A: the lead
 * that has waited longest is the most urgent, not the most recent.
 */
export async function listUnansweredLeadsForToday(
  organizationId: string,
  limit = 5,
): Promise<TodayLead[]> {
  const supabase = await createClient();
  const { data: leads, error } = await supabase
    .from("lead_overview")
    .select(
      "id, first_name, last_name, source, message, created_at, property_id",
    )
    .eq("organization_id", organizationId)
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to load unanswered leads:", error.message);
    return [];
  }
  if (leads.length === 0) return [];

  const propertyIds = [
    ...new Set(
      leads.map((l) => l.property_id).filter((v): v is string => Boolean(v)),
    ),
  ];
  const propertyById = new Map<string, string>();
  if (propertyIds.length > 0) {
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id, title")
      .in("id", propertyIds);
    if (propertiesError) {
      console.error(
        "Failed to load properties for unanswered leads:",
        propertiesError.message,
      );
    } else {
      for (const p of properties) propertyById.set(p.id, p.title);
    }
  }

  return leads.map((l) => ({
    id: l.id,
    name: `${l.first_name} ${l.last_name ?? ""}`.trim(),
    source: l.source,
    message: l.message,
    created_at: l.created_at,
    property_title: l.property_id
      ? (propertyById.get(l.property_id) ?? null)
      : null,
  }));
}

export type TodayDeal = {
  id: string;
  status: DealStatus;
  next_action_at: string | null;
  property_title: string | null;
};

/**
 * Active deals whose next task is due today or already overdue — same
 * "date-only due_at" boundary as listTasksDueToday/listOverdueTasks
 * (`deal_overview.next_action_at` is sourced from `tasks.due_at`, so it
 * shares the exact same UTC-midnight convention; see lib/date.ts).
 */
export async function listDealsNeedingAttentionForToday(
  organizationId: string,
  limit = 5,
): Promise<TodayDeal[]> {
  const { endUtc } = getDateOnlyTodayBoundsUtc();
  const supabase = await createClient();
  const { data: deals, error } = await supabase
    .from("deal_overview")
    .select("id, status, next_action_at, property_id")
    .eq("organization_id", organizationId)
    .not("status", "in", "(closed,cancelled)")
    .not("next_action_at", "is", null)
    .lt("next_action_at", endUtc)
    .order("next_action_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to load deals needing attention:", error.message);
    return [];
  }
  if (deals.length === 0) return [];

  const propertyIds = [...new Set(deals.map((d) => d.property_id))];
  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id, title")
    .in("id", propertyIds);
  if (propertiesError) {
    console.error(
      "Failed to load properties for deals needing attention:",
      propertiesError.message,
    );
  }
  const propertyById = new Map((properties ?? []).map((p) => [p.id, p.title]));

  return deals.map((d) => ({
    id: d.id,
    status: d.status,
    next_action_at: d.next_action_at,
    property_title: propertyById.get(d.property_id) ?? null,
  }));
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
 * siempre una próxima acción", plus leads still unanswered — together this
 * is the "Requieren tu atención" block (V2 bloque A,
 * docs/V2_EVOLUTION_PLAN.md). "Seguimientos vencidos" is deliberately NOT
 * counted here: the caller already fetches `listOverdueTasks` for its own
 * card, and reusing that count (instead of a duplicate query) is how the
 * page composes the final unified list — see app/(dashboard)/today/page.tsx.
 */
export async function listCommercialAlerts(
  organizationId: string,
): Promise<CommercialAlert[]> {
  const supabase = await createClient();

  const [searches, acquisitions, deals, leads] = await Promise.all([
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
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "new"),
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
  if (leads.error)
    console.error("Failed to count lead alerts:", leads.error.message);

  const alerts: CommercialAlert[] = [];
  const searchCount = searches.count ?? 0;
  const acquisitionCount = acquisitions.count ?? 0;
  const dealCount = deals.count ?? 0;
  const leadCount = leads.count ?? 0;

  if (leadCount > 0) {
    alerts.push(
      pluralAlert(
        leadCount,
        `${leadCount} lead nuevo sin responder`,
        `${leadCount} leads nuevos sin responder`,
        "/leads?status=new",
      ),
    );
  }
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
