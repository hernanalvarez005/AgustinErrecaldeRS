import "server-only";

import { getBusinessDayBoundsUtc, getDateOnlyTodayBoundsUtc } from "@/lib/date";
import {
  resolveEngagementLinks,
  type EngagementLink,
} from "@/lib/data/engagement-links";
import { createClient } from "@/lib/supabase/server";
import type { ActivityType } from "@/types/database.types";

export type TodayLink = EngagementLink;

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

/** Scheduled activities (calls, meetings, visits...) happening today. */
export async function listTodayActivities(
  organizationId: string,
): Promise<TodayActivity[]> {
  const { startUtc, endUtc } = getBusinessDayBoundsUtc();
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
