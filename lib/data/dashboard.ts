import "server-only";

import {
  getBusinessRangeBoundsUtc,
  getPeriodYmdRange,
  type DashboardPeriod,
} from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import {
  ACQUISITION_KANBAN_COLUMNS,
  ACQUISITION_STATUS_LABELS,
} from "@/lib/validations/acquisition";
import {
  DEAL_KANBAN_COLUMNS,
  DEAL_STATUS_LABELS,
} from "@/lib/validations/deal";
import {
  SEARCH_STATUS_LABELS,
  SEARCH_STATUSES,
} from "@/lib/validations/search";
import type {
  AcquisitionStatus,
  DealStatus,
  SearchStatus,
} from "@/types/database.types";

export type FunnelStage = { status: string; label: string; count: number };

/** Every row this dashboard reads is capped here — a solo advisor's data volume never approaches this, and it keeps every query a single cheap round trip instead of paginating. */
const FUNNEL_ROW_LIMIT = 2000;

function bucketByStatus<S extends string>(
  rows: { status: S }[],
  order: readonly S[],
  labels: Record<S, string>,
): FunnelStage[] {
  const counts = new Map<S, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  return order.map((status) => ({
    status,
    label: labels[status],
    count: counts.get(status) ?? 0,
  }));
}

export type LeadsKpi = {
  newLeads: number;
  responded: number;
  converted: number;
};

/**
 * New leads created in the period, how many of them (or earlier ones)
 * converted within it, and how many of the period's leads have moved past
 * `new` — see docs/DATABASE.md on why these use different filtering
 * strategies. "Respondidos" is a cohort snapshot like the funnels below
 * (no dedicated "first response" timestamp exists in the schema): leads
 * created in the period whose CURRENT status isn't `new` anymore — the
 * most honest signal buildable with what's tracked today.
 */
export async function getLeadsKpi(
  organizationId: string,
  period: DashboardPeriod,
): Promise<LeadsKpi> {
  const { startYmd, endYmdExclusive } = getPeriodYmdRange(period);
  const { startUtc, endUtc } = getBusinessRangeBoundsUtc(
    startYmd ?? "1900-01-01",
    endYmdExclusive,
  );
  const supabase = await createClient();

  let newLeadsQuery = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .lt("created_at", endUtc);
  if (startYmd) newLeadsQuery = newLeadsQuery.gte("created_at", startUtc);

  let respondedQuery = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .neq("status", "new")
    .lt("created_at", endUtc);
  if (startYmd) respondedQuery = respondedQuery.gte("created_at", startUtc);

  let convertedQuery = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "converted")
    .lt("converted_at", endUtc);
  if (startYmd) convertedQuery = convertedQuery.gte("converted_at", startUtc);

  const [newLeadsRes, respondedRes, convertedRes] = await Promise.all([
    newLeadsQuery,
    respondedQuery,
    convertedQuery,
  ]);

  if (newLeadsRes.error)
    console.error("Failed to count new leads:", newLeadsRes.error.message);
  if (respondedRes.error)
    console.error(
      "Failed to count responded leads:",
      respondedRes.error.message,
    );
  if (convertedRes.error)
    console.error(
      "Failed to count converted leads:",
      convertedRes.error.message,
    );

  return {
    newLeads: newLeadsRes.count ?? 0,
    responded: respondedRes.count ?? 0,
    converted: convertedRes.count ?? 0,
  };
}

/** Property/acquisition visits (activities) that happened or are scheduled within the period. */
export async function getVisitsKpi(
  organizationId: string,
  period: DashboardPeriod,
): Promise<number> {
  const { startYmd, endYmdExclusive } = getPeriodYmdRange(period);
  const { startUtc, endUtc } = getBusinessRangeBoundsUtc(
    startYmd ?? "1900-01-01",
    endYmdExclusive,
  );
  const supabase = await createClient();

  let query = supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("type", ["property_visit", "acquisition_visit"])
    .lt("starts_at", endUtc);
  if (startYmd) query = query.gte("starts_at", startUtc);

  const { count, error } = await query;
  if (error) console.error("Failed to count visits:", error.message);
  return count ?? 0;
}

/** Valuations recorded within the period, by their own valuation_date (a native `date`) — "Tasaciones" (V2 bloque H). */
export async function getValuationsKpi(
  organizationId: string,
  period: DashboardPeriod,
): Promise<number> {
  const { startYmd, endYmdExclusive } = getPeriodYmdRange(period);
  const supabase = await createClient();

  let query = supabase
    .from("valuations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .lt("valuation_date", endYmdExclusive);
  if (startYmd) query = query.gte("valuation_date", startYmd);

  const { count, error } = await query;
  if (error) console.error("Failed to count valuations:", error.message);
  return count ?? 0;
}

/**
 * Deals that reached the reservation milestone within the period, by
 * `reservation_date` (a native `date`) — "Reservas" (V2 bloque H). Gated
 * to `status` at or past `reservation` for the same reason
 * `getClosingsKpi` gates on `status = 'closed'`: `reservation_date` is an
 * editable field on the deal form, so a date alone doesn't prove the
 * milestone was actually reached yet.
 */
const RESERVED_OR_LATER_DEAL_STATUSES = [
  "reservation",
  "documentation",
  "contract",
  "closing",
  "closed",
] as const;

export async function getReservationsKpi(
  organizationId: string,
  period: DashboardPeriod,
): Promise<number> {
  const { startYmd, endYmdExclusive } = getPeriodYmdRange(period);
  const supabase = await createClient();

  let query = supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", RESERVED_OR_LATER_DEAL_STATUSES)
    .not("reservation_date", "is", null)
    .lt("reservation_date", endYmdExclusive);
  if (startYmd) query = query.gte("reservation_date", startYmd);

  const { count, error } = await query;
  if (error) console.error("Failed to count reservations:", error.message);
  return count ?? 0;
}

export type ClosingsKpi = {
  count: number;
  commissionByCurrency: Partial<Record<"ARS" | "USD", number>>;
};

/** Deals that actually closed within the period, by their real closing_date (a native `date`, not created_at — see docs/ARCHITECTURE.md on why closings/commission use milestone dates instead of a creation-date proxy). */
export async function getClosingsKpi(
  organizationId: string,
  period: DashboardPeriod,
): Promise<ClosingsKpi> {
  // closing_date is a native Postgres `date` — compare directly against
  // "YYYY-MM-DD" strings, no need to round-trip through a UTC instant.
  const { startYmd, endYmdExclusive } = getPeriodYmdRange(period);
  const supabase = await createClient();

  let query = supabase
    .from("deals")
    .select("estimated_commission, commission_currency")
    .eq("organization_id", organizationId)
    .eq("status", "closed")
    .not("closing_date", "is", null)
    .lt("closing_date", endYmdExclusive)
    .limit(FUNNEL_ROW_LIMIT);
  if (startYmd) query = query.gte("closing_date", startYmd);

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load closings:", error.message);
    return { count: 0, commissionByCurrency: {} };
  }

  const commissionByCurrency: Partial<Record<"ARS" | "USD", number>> = {};
  for (const deal of data) {
    if (deal.estimated_commission && deal.commission_currency) {
      const currency = deal.commission_currency as "ARS" | "USD";
      commissionByCurrency[currency] =
        (commissionByCurrency[currency] ?? 0) + deal.estimated_commission;
    }
  }

  return { count: data.length, commissionByCurrency };
}

/** Acquisitions opened in the period, bucketed by their current pipeline stage. */
export async function getAcquisitionFunnel(
  organizationId: string,
  period: DashboardPeriod,
): Promise<FunnelStage[]> {
  const { startYmd, endYmdExclusive } = getPeriodYmdRange(period);
  const { startUtc, endUtc } = getBusinessRangeBoundsUtc(
    startYmd ?? "1900-01-01",
    endYmdExclusive,
  );
  const supabase = await createClient();

  let query = supabase
    .from("property_acquisitions")
    .select("status")
    .eq("organization_id", organizationId)
    .lt("created_at", endUtc)
    .limit(FUNNEL_ROW_LIMIT);
  if (startYmd) query = query.gte("created_at", startUtc);

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load acquisition funnel:", error.message);
    return [];
  }
  return bucketByStatus<AcquisitionStatus>(
    data,
    ACQUISITION_KANBAN_COLUMNS,
    ACQUISITION_STATUS_LABELS,
  );
}

/** Searches (buyer opportunities) opened in the period, bucketed by their current pipeline stage. */
export async function getSearchFunnel(
  organizationId: string,
  period: DashboardPeriod,
): Promise<FunnelStage[]> {
  const { startYmd, endYmdExclusive } = getPeriodYmdRange(period);
  const { startUtc, endUtc } = getBusinessRangeBoundsUtc(
    startYmd ?? "1900-01-01",
    endYmdExclusive,
  );
  const supabase = await createClient();

  let query = supabase
    .from("property_searches")
    .select("status")
    .eq("organization_id", organizationId)
    .lt("created_at", endUtc)
    .limit(FUNNEL_ROW_LIMIT);
  if (startYmd) query = query.gte("created_at", startUtc);

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load search funnel:", error.message);
    return [];
  }
  return bucketByStatus<SearchStatus>(
    data,
    SEARCH_STATUSES,
    SEARCH_STATUS_LABELS,
  );
}

/** Deals opened in the period, bucketed by their current pipeline stage. */
export async function getDealFunnel(
  organizationId: string,
  period: DashboardPeriod,
): Promise<FunnelStage[]> {
  const { startYmd, endYmdExclusive } = getPeriodYmdRange(period);
  const { startUtc, endUtc } = getBusinessRangeBoundsUtc(
    startYmd ?? "1900-01-01",
    endYmdExclusive,
  );
  const supabase = await createClient();

  let query = supabase
    .from("deals")
    .select("status")
    .eq("organization_id", organizationId)
    .lt("created_at", endUtc)
    .limit(FUNNEL_ROW_LIMIT);
  if (startYmd) query = query.gte("created_at", startUtc);

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load deal funnel:", error.message);
    return [];
  }
  return bucketByStatus<DealStatus>(
    data,
    DEAL_KANBAN_COLUMNS,
    DEAL_STATUS_LABELS,
  );
}
