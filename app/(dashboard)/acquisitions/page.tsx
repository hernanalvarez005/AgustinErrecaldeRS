import { Plus } from "lucide-react";
import Link from "next/link";

import { KanbanBoard } from "@/components/acquisitions/kanban-board";
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
import { listAcquisitions } from "@/lib/data/acquisitions";
import { formatDate } from "@/lib/format";
import { ACQUISITION_STATUS_LABELS } from "@/lib/validations/acquisition";

export default async function AcquisitionsPage({
  searchParams,
}: PageProps<"/acquisitions">) {
  const params = await searchParams;
  const view = params.view === "table" ? "table" : "kanban";
  const membership = await requireMembership();
  const acquisitions = await listAcquisitions(membership.organization.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Captaciones</h1>
          <p className="text-muted-foreground text-sm">
            {acquisitions.length}{" "}
            {acquisitions.length === 1 ? "captación" : "captaciones"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            render={
              <Link
                href={`/acquisitions?view=${view === "kanban" ? "table" : "kanban"}`}
              />
            }
            nativeButton={false}
            variant="outline"
          >
            {view === "kanban" ? "Ver tabla" : "Ver Kanban"}
          </Button>
          <Button
            render={<Link href="/acquisitions/new" />}
            nativeButton={false}
          >
            <Plus />
            Captación
          </Button>
        </div>
      </div>

      {acquisitions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">Todavía no tenés captaciones.</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Registrá un propietario interesado en vender para comenzar.
          </p>
          <Button
            render={<Link href="/acquisitions/new" />}
            nativeButton={false}
          >
            <Plus />
            Nueva captación
          </Button>
        </div>
      ) : view === "kanban" ? (
        <KanbanBoard acquisitions={acquisitions} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Propietario</TableHead>
                <TableHead>Valor estimado</TableHead>
                <TableHead>Próxima acción</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acquisitions.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/acquisitions/${a.id}`}
                      className="hover:underline"
                    >
                      {a.property?.title ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {a.owner
                      ? `${a.owner.first_name} ${a.owner.last_name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {a.estimated_value
                      ? a.estimated_value.toLocaleString("es-AR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(a.next_action_at) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {ACQUISITION_STATUS_LABELS[a.status]}
                    </Badge>
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
