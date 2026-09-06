import { Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth/session";
import { listLeads } from "@/lib/data/leads";
import { formatDate, formatEventDay } from "@/lib/format";
import {
  CONTACT_SOURCE_LABELS,
  CONTACT_SOURCES,
} from "@/lib/validations/contact";
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/validations/lead";
import type { ContactSource, LeadStatus } from "@/types/database.types";

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const params = await searchParams;
  const membership = await requireMembership();

  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const status = LEAD_STATUSES.includes(statusParam as LeadStatus)
    ? (statusParam as LeadStatus)
    : undefined;
  const sourceParam =
    typeof params.source === "string" ? params.source : undefined;
  const source = CONTACT_SOURCES.includes(sourceParam as ContactSource)
    ? (sourceParam as ContactSource)
    : undefined;
  const search =
    typeof params.search === "string" && params.search
      ? params.search
      : undefined;

  const leads = await listLeads({
    organizationId: membership.organization.id,
    status,
    source,
    search,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-muted-foreground text-sm">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
          </p>
        </div>
        <Button render={<Link href="/leads/new" />} nativeButton={false}>
          <Plus />
          Lead
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" action="/leads">
        <Input
          name="search"
          defaultValue={search}
          placeholder="Nombre, teléfono o email..."
          className="max-w-56"
        />
        <Select
          name="source"
          defaultValue={source ?? "all"}
          items={{ all: "Todos los orígenes", ...CONTACT_SOURCE_LABELS }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los orígenes</SelectItem>
            {CONTACT_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {CONTACT_SOURCE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          name="status"
          defaultValue={status ?? "all"}
          items={{ all: "Todos los estados", ...LEAD_STATUS_LABELS }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {leads.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">Todavía no tenés leads.</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Cargá acá cualquier consulta que te llegue por WhatsApp, portales o
            Instagram para no perderla de vista.
          </p>
          <Button render={<Link href="/leads/new" />} nativeButton={false}>
            <Plus />
            Nuevo lead
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ingresó</TableHead>
                <TableHead>Próxima acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="hover:underline"
                    >
                      {lead.first_name} {lead.last_name ?? ""}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {lead.phone || lead.email || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-64 truncate text-sm">
                    {lead.message || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {lead.source ? CONTACT_SOURCE_LABELS[lead.source] : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatEventDay(lead.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(lead.next_action_at) ?? "—"}
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
