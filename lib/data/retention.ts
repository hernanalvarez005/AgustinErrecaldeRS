import "server-only";

import {
  addDaysToYmd,
  getBusinessDayBoundsUtc,
  getBusinessRangeBoundsUtc,
  isSameMonthDay,
  todayYmdInBusinessTimezone,
} from "@/lib/date";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { TaskCategory } from "@/types/database.types";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

/** Days after a deal's closing_date before the postventa follow-up fires. */
const POSTVENTA_FOLLOW_UP_DAYS = 30;

export type RetentionTaskCounts = {
  postventa: number;
  anniversary: number;
  birthday: number;
};

/**
 * Creates follow-up tasks for (1) deals closed 30+ days ago (postventa),
 * (2) deals whose closing anniversary is today, and (3) contacts whose
 * birthday is today — see docs/ROADMAP.md, Fase 12. Never sends a
 * message; only ever creates a `tasks` row for the advisor to act on
 * however they choose.
 *
 * Runs across every organization (uses the service-role client — there is
 * no signed-in user here, so the normal RLS-scoped client can't be used).
 * Meant to be called once a day by app/api/cron/retention-tasks/route.ts.
 *
 * Idempotent, with different tolerances by design:
 * - Postventa uses "closing_date <= today - 30 days" (not "= today - 30"),
 *   so a day the cron didn't run still gets caught up on the next run.
 * - Anniversary/birthday only fire on their exact calendar day (comparing
 *   just month+day, any year) — a missed day means that year's reminder
 *   is skipped, not retried. Vercel Cron runs daily and reliably enough
 *   that this simplification isn't worth the extra complexity of a
 *   catch-up window (documented in docs/DATABASE.md, Fase 12).
 * Every category checks for an existing task before inserting, so running
 * this more than once on the same day never creates duplicates.
 */
export async function generateRetentionTasks(): Promise<RetentionTaskCounts> {
  const supabase = createServiceRoleClient();
  const todayYmd = todayYmdInBusinessTimezone();
  const dueAtUtc = getBusinessDayBoundsUtc(todayYmd).startUtc;

  const [postventa, anniversary, birthday] = await Promise.all([
    createPostventaFollowUps(supabase, todayYmd, dueAtUtc),
    createAnniversaryFollowUps(supabase, todayYmd, dueAtUtc),
    createBirthdayFollowUps(supabase, todayYmd, dueAtUtc),
  ]);

  return { postventa, anniversary, birthday };
}

async function hasExistingTask(
  supabase: ServiceRoleClient,
  filters: {
    category: TaskCategory;
    dealId?: string;
    contactId?: string;
    dueAfterUtc?: string;
    dueBeforeUtc?: string;
  },
): Promise<boolean> {
  let query = supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("category", filters.category);
  if (filters.dealId) query = query.eq("deal_id", filters.dealId);
  if (filters.contactId) query = query.eq("contact_id", filters.contactId);
  if (filters.dueAfterUtc) query = query.gte("due_at", filters.dueAfterUtc);
  if (filters.dueBeforeUtc) query = query.lt("due_at", filters.dueBeforeUtc);

  const { count, error } = await query;
  if (error) {
    console.error(
      "[retention] Failed to check for an existing task:",
      error.message,
    );
    return true; // fail closed: skip creating rather than risk a duplicate.
  }
  return (count ?? 0) > 0;
}

async function ensurePastClientRole(
  supabase: ServiceRoleClient,
  contactId: string,
) {
  const { error } = await supabase
    .from("contact_roles")
    .upsert(
      { contact_id: contactId, role: "past_client" },
      { onConflict: "contact_id,role", ignoreDuplicates: true },
    );
  if (error) {
    console.error("[retention] Failed to set past_client role:", error.message);
  }
}

async function createPostventaFollowUps(
  supabase: ServiceRoleClient,
  todayYmd: string,
  dueAtUtc: string,
): Promise<number> {
  const cutoffYmd = addDaysToYmd(todayYmd, -POSTVENTA_FOLLOW_UP_DAYS);

  const { data: deals, error } = await supabase
    .from("deals")
    .select("id, organization_id, buyer_contact_id, seller_contact_id")
    .eq("status", "closed")
    .not("closing_date", "is", null)
    .lte("closing_date", cutoffYmd);

  if (error) {
    console.error(
      "[retention] Failed to load closed deals for postventa:",
      error.message,
    );
    return 0;
  }

  let created = 0;
  for (const deal of deals) {
    const exists = await hasExistingTask(supabase, {
      category: "follow_up_postventa",
      dealId: deal.id,
    });
    if (exists) continue;

    const { error: insertError } = await supabase.from("tasks").insert({
      organization_id: deal.organization_id,
      title: "Seguimiento postventa",
      description:
        "Esta operación cerró hace 30 días — un buen momento para consultar cómo va todo.",
      deal_id: deal.id,
      contact_id: deal.buyer_contact_id,
      category: "follow_up_postventa",
      due_at: dueAtUtc,
    });
    if (insertError) {
      console.error(
        "[retention] Failed to create postventa task:",
        insertError.message,
      );
      continue;
    }
    created += 1;

    await ensurePastClientRole(supabase, deal.buyer_contact_id);
    await ensurePastClientRole(supabase, deal.seller_contact_id);
  }
  return created;
}

async function createAnniversaryFollowUps(
  supabase: ServiceRoleClient,
  todayYmd: string,
  dueAtUtc: string,
): Promise<number> {
  const { data: deals, error } = await supabase
    .from("deals")
    .select("id, organization_id, buyer_contact_id, closing_date")
    .eq("status", "closed")
    .not("closing_date", "is", null);

  if (error) {
    console.error(
      "[retention] Failed to load closed deals for anniversaries:",
      error.message,
    );
    return 0;
  }

  const currentYear = Number(todayYmd.slice(0, 4));
  const candidates = deals.filter((deal) => {
    const closingDate = deal.closing_date as string;
    const closingYear = Number(closingDate.slice(0, 4));
    return closingYear < currentYear && isSameMonthDay(closingDate, todayYmd);
  });
  if (candidates.length === 0) return 0;

  const { startUtc, endUtc } = getBusinessRangeBoundsUtc(
    `${currentYear}-01-01`,
    `${currentYear + 1}-01-01`,
  );

  let created = 0;
  for (const deal of candidates) {
    const exists = await hasExistingTask(supabase, {
      category: "follow_up_anniversary",
      dealId: deal.id,
      dueAfterUtc: startUtc,
      dueBeforeUtc: endUtc,
    });
    if (exists) continue;

    const years =
      currentYear - Number((deal.closing_date as string).slice(0, 4));
    const { error: insertError } = await supabase.from("tasks").insert({
      organization_id: deal.organization_id,
      title: `Aniversario de cierre (${years} ${years === 1 ? "año" : "años"})`,
      description:
        "Hoy se cumple el aniversario de esta operación — una buena excusa para saludar.",
      deal_id: deal.id,
      contact_id: deal.buyer_contact_id,
      category: "follow_up_anniversary",
      due_at: dueAtUtc,
    });
    if (insertError) {
      console.error(
        "[retention] Failed to create anniversary task:",
        insertError.message,
      );
      continue;
    }
    created += 1;
  }
  return created;
}

async function createBirthdayFollowUps(
  supabase: ServiceRoleClient,
  todayYmd: string,
  dueAtUtc: string,
): Promise<number> {
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, organization_id, birth_date")
    .not("birth_date", "is", null)
    .is("archived_at", null);

  if (error) {
    console.error(
      "[retention] Failed to load contacts for birthdays:",
      error.message,
    );
    return 0;
  }

  const candidates = contacts.filter((c) =>
    isSameMonthDay(c.birth_date as string, todayYmd),
  );
  if (candidates.length === 0) return 0;

  const currentYear = Number(todayYmd.slice(0, 4));
  const { startUtc, endUtc } = getBusinessRangeBoundsUtc(
    `${currentYear}-01-01`,
    `${currentYear + 1}-01-01`,
  );

  let created = 0;
  for (const contact of candidates) {
    const exists = await hasExistingTask(supabase, {
      category: "follow_up_birthday",
      contactId: contact.id,
      dueAfterUtc: startUtc,
      dueBeforeUtc: endUtc,
    });
    if (exists) continue;

    const { error: insertError } = await supabase.from("tasks").insert({
      organization_id: contact.organization_id,
      title: "Cumpleaños",
      description:
        "Hoy es el cumpleaños de este contacto — un buen día para saludar.",
      contact_id: contact.id,
      category: "follow_up_birthday",
      due_at: dueAtUtc,
    });
    if (insertError) {
      console.error(
        "[retention] Failed to create birthday task:",
        insertError.message,
      );
      continue;
    }
    created += 1;
  }
  return created;
}
