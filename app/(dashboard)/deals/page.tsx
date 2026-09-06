import { Plus } from "lucide-react";
import Link from "next/link";

import { KanbanBoard } from "@/components/deals/kanban-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth/session";
import { listDeals } from "@/lib/data/deals";
import { formatDate } from "@/lib/format";
import { DEAL_STATUS_LABELS } from "@/lib/validations/deal";

function formatPrice(value: number | null, currency: "ARS" | "USD" | null) {
  if (!value || !currency) return "—";
  return `${currency} ${value.toLocaleString("es-AR")}`;
}

export default async function DealsPage({ searchParams }: PageProps<"/deals">) {
  const params = await searchParams;
  const view = params.view === "table" ? "table" : "kanban";
  const membership = await requireMembership();
  const deals = await listDeals(membership.organization.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operaciones</h1>
          <p className="text-muted-foreground text-sm">
            {deals.length} {deals.length === 1 ? "operación" : "operaciones"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            render={
              <Link
                href={`/deals?view=${view === "kanban" ? "table" : "kanban"}`}
              />
            }
            nativeButton={false}
            variant="outline"
          >
            {view === "kanban" ? "Ver tabla" : "Ver Kanban"}
          </Button>
          <Button render={<Link href="/deals/new" />} nativeButton={false}>
            <Plus />
            Operación
          </Button>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">Todavía no tenés operaciones.</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Registrá un comprador y un vendedor negociando una propiedad para
            empezar a hacer seguimiento del cierre.
          </p>
          <Button render={<Link href="/deals/new" />} nativeButton={false}>
            <Plus />
            Nueva operación
          </Button>
        </div>
      ) : view === "kanban" ? (
        <KanbanBoard deals={deals} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Próxima acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <Link href={`/deals/${d.id}`} className="hover:underline">
                      {d.property?.title ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {d.buyer
                      ? `${d.buyer.first_name} ${d.buyer.last_name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {d.seller
                      ? `${d.seller.first_name} ${d.seller.last_name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatPrice(
                      d.agreed_price ?? d.offer_price ?? d.asking_price,
                      d.currency,
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {DEAL_STATUS_LABELS[d.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(d.next_action_at) ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
