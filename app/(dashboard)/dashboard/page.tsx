import Link from "next/link";

import { FunnelBars } from "@/components/dashboard/funnel-bars";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import {
  getAcquisitionFunnel,
  getClosingsKpi,
  getDealFunnel,
  getLeadsKpi,
  getReservationsKpi,
  getSearchFunnel,
  getValuationsKpi,
  getVisitsKpi,
  type ClosingsKpi,
  type LeadsKpi,
} from "@/lib/data/dashboard";
import {
  DASHBOARD_PERIOD_LABELS,
  getPreviousPeriodYmdRange,
  type DashboardPeriod,
} from "@/lib/date";

const DASHBOARD_PERIODS: DashboardPeriod[] = [
  "this_month",
  "last_month",
  "quarter",
  "year",
  "all",
];

function formatCommission(
  commissionByCurrency: Partial<Record<"ARS" | "USD", number>>,
) {
  const entries = Object.entries(commissionByCurrency) as [
    "ARS" | "USD",
    number,
  ][];
  if (entries.length === 0) return "—";
  return entries
    .map(([currency, value]) => `${currency} ${value.toLocaleString("es-AR")}`)
    .join(" · ");
}

/**
 * Whole-number % change vs. a previous value — `null` when there's no
 * usable baseline (previous period was 0 but current isn't: the change is
 * technically infinite, showing e.g. "+∞%" would be meaningless) rather
 * than a misleading number. 0/0 is a real "no change" (0%), not "no
 * baseline".
 */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function DashboardKpiPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const params = await searchParams;
  const period: DashboardPeriod = DASHBOARD_PERIODS.includes(
    params.period as DashboardPeriod,
  )
    ? (params.period as DashboardPeriod)
    : "this_month";

  const membership = await requireMembership();
  const organizationId = membership.organization.id;
  const previousRange = getPreviousPeriodYmdRange(period);

  const [
    leads,
    visits,
    valuations,
    reservations,
    closings,
    acquisitionFunnel,
    searchFunnel,
    dealFunnel,
    previousLeads,
    previousVisits,
    previousValuations,
    previousReservations,
    previousClosings,
  ] = await Promise.all([
    getLeadsKpi(organizationId, period),
    getVisitsKpi(organizationId, period),
    getValuationsKpi(organizationId, period),
    getReservationsKpi(organizationId, period),
    getClosingsKpi(organizationId, period),
    getAcquisitionFunnel(organizationId, period),
    getSearchFunnel(organizationId, period),
    getDealFunnel(organizationId, period),
    previousRange
      ? getLeadsKpi(organizationId, previousRange)
      : Promise.resolve<LeadsKpi | null>(null),
    previousRange
      ? getVisitsKpi(organizationId, previousRange)
      : Promise.resolve<number | null>(null),
    previousRange
      ? getValuationsKpi(organizationId, previousRange)
      : Promise.resolve<number | null>(null),
    previousRange
      ? getReservationsKpi(organizationId, previousRange)
      : Promise.resolve<number | null>(null),
    previousRange
      ? getClosingsKpi(organizationId, previousRange)
      : Promise.resolve<ClosingsKpi | null>(null),
  ]);

  // The acquisition funnel already buckets this period's cohort by current
  // status (lib/data/dashboard.ts) — "propiedades captadas" reuses that
  // "won" bucket instead of a second, redundant query. No previous-period
  // delta for this one: it's derived from the funnel's cohort snapshot,
  // not a milestone-dated KPI query like the other five.
  const acquisitionsWon =
    acquisitionFunnel.find((stage) => stage.status === "won")?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex gap-1 rounded-lg border p-1">
          {DASHBOARD_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/dashboard?period=${p}`}
              className={`rounded-md px-2.5 py-1 text-sm ${
                p === period
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {DASHBOARD_PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Leads nuevos"
          value={leads.newLeads}
          delta={
            previousLeads
              ? pctChange(leads.newLeads, previousLeads.newLeads)
              : null
          }
        />
        <KpiCard
          label="Leads respondidos"
          value={leads.responded}
          delta={
            previousLeads
              ? pctChange(leads.responded, previousLeads.responded)
              : null
          }
        />
        <KpiCard
          label="Leads convertidos"
          value={leads.converted}
          delta={
            previousLeads
              ? pctChange(leads.converted, previousLeads.converted)
              : null
          }
        />
        <KpiCard
          label="Visitas"
          value={visits}
          delta={
            previousVisits !== null ? pctChange(visits, previousVisits) : null
          }
        />
        <KpiCard
          label="Tasaciones"
          value={valuations}
          delta={
            previousValuations !== null
              ? pctChange(valuations, previousValuations)
              : null
          }
        />
        <KpiCard label="Propiedades captadas" value={acquisitionsWon} />
        <KpiCard
          label="Reservas"
          value={reservations}
          delta={
            previousReservations !== null
              ? pctChange(reservations, previousReservations)
              : null
          }
        />
        <KpiCard
          label="Cierres"
          value={closings.count}
          delta={
            previousClosings
              ? pctChange(closings.count, previousClosings.count)
              : null
          }
        >
          <CardContent className="text-muted-foreground pt-0 text-xs">
            Comisión: {formatCommission(closings.commissionByCurrency)}
          </CardContent>
        </KpiCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Embudo de captaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelBars stages={acquisitionFunnel} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Embudo de compradores</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelBars stages={searchFunnel} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Embudo de operaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelBars stages={dealFunnel} />
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-xs">
        Los embudos cuentan las oportunidades abiertas en el período elegido,
        según su etapa actual — no un historial de en qué etapa estuvo cada una
        en cada momento (el esquema no lleva ese registro todavía). El
        porcentaje de cada etapa es relativo a la primera etapa del embudo.
      </p>
    </div>
  );
}
