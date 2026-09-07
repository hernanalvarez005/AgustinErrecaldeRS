import Link from "next/link";

import { FunnelBars } from "@/components/dashboard/funnel-bars";
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
} from "@/lib/data/dashboard";
import { DASHBOARD_PERIOD_LABELS, type DashboardPeriod } from "@/lib/date";

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

  const [
    leads,
    visits,
    valuations,
    reservations,
    closings,
    acquisitionFunnel,
    searchFunnel,
    dealFunnel,
  ] = await Promise.all([
    getLeadsKpi(organizationId, period),
    getVisitsKpi(organizationId, period),
    getValuationsKpi(organizationId, period),
    getReservationsKpi(organizationId, period),
    getClosingsKpi(organizationId, period),
    getAcquisitionFunnel(organizationId, period),
    getSearchFunnel(organizationId, period),
    getDealFunnel(organizationId, period),
  ]);

  // The acquisition funnel already buckets this period's cohort by current
  // status (lib/data/dashboard.ts) — "propiedades captadas" reuses that
  // "won" bucket instead of a second, redundant query.
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
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              {DASHBOARD_PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Leads nuevos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {leads.newLeads}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Leads respondidos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {leads.responded}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Leads convertidos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {leads.converted}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Visitas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{visits}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Tasaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {valuations}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Propiedades captadas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {acquisitionsWon}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Reservas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {reservations}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Cierres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{closings.count}</p>
            <p className="text-muted-foreground text-sm">
              Comisión: {formatCommission(closings.commissionByCurrency)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Embudo de captaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelBars stages={acquisitionFunnel} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Embudo de compradores</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelBars stages={searchFunnel} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Embudo de operaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelBars stages={dealFunnel} />
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-xs">
        Los embudos cuentan las oportunidades abiertas en el período elegido,
        según su etapa actual — no un historial de en qué etapa estuvo cada una
        en cada momento (el esquema no lleva ese registro todavía).
      </p>
    </div>
  );
}
