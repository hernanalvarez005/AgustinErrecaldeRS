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
import { listSearches } from "@/lib/data/searches";
import { formatDate, formatEventDay } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/validations/property";
import {
  SEARCH_OBJECTIVE_LABELS,
  SEARCH_OBJECTIVES,
  SEARCH_STATUS_LABELS,
  SEARCH_STATUSES,
  SEARCH_URGENCY_LABELS,
  SEARCH_URGENCIES,
} from "@/lib/validations/search";
import type {
  SearchObjective,
  SearchStatus,
  SearchUrgency,
} from "@/types/database.types";

function formatBudget(
  min: number | null,
  max: number | null,
  currency: string | null,
) {
  if (!currency || (min === null && max === null)) return "—";
  const fmt = (n: number) => n.toLocaleString("es-AR");
  if (min !== null && max !== null)
    return `${currency} ${fmt(min)}–${fmt(max)}`;
  if (min !== null) return `Desde ${currency} ${fmt(min)}`;
  return `Hasta ${currency} ${fmt(max as number)}`;
}

export default async function SearchesPage({
  searchParams,
}: PageProps<"/searches">) {
  const params = await searchParams;
  const membership = await requireMembership();

  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const status = SEARCH_STATUSES.includes(statusParam as SearchStatus)
    ? (statusParam as SearchStatus)
    : undefined;
  const objectiveParam =
    typeof params.objective === "string" ? params.objective : undefined;
  const objective = SEARCH_OBJECTIVES.includes(
    objectiveParam as SearchObjective,
  )
    ? (objectiveParam as SearchObjective)
    : undefined;
  const urgencyParam =
    typeof params.urgency === "string" ? params.urgency : undefined;
  const urgency = SEARCH_URGENCIES.includes(urgencyParam as SearchUrgency)
    ? (urgencyParam as SearchUrgency)
    : undefined;
  const city =
    typeof params.city === "string" && params.city ? params.city : undefined;
  const minBedroomsParam =
    typeof params.minBedrooms === "string"
      ? Number(params.minBedrooms)
      : undefined;
  const minBedrooms =
    minBedroomsParam && !Number.isNaN(minBedroomsParam)
      ? minBedroomsParam
      : undefined;

  const searches = await listSearches({
    organizationId: membership.organization.id,
    status,
    objective,
    urgency,
    city,
    minBedrooms,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Búsquedas</h1>
          <p className="text-muted-foreground text-sm">
            {searches.length} {searches.length === 1 ? "búsqueda" : "búsquedas"}
          </p>
        </div>
        <Button render={<Link href="/searches/new" />} nativeButton={false}>
          <Plus />
          Búsqueda
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" action="/searches">
        <Input
          name="city"
          defaultValue={city}
          placeholder="Zona..."
          className="max-w-40"
        />
        <Input
          name="minBedrooms"
          type="number"
          defaultValue={minBedrooms}
          placeholder="Dorm. mín."
          className="max-w-32"
        />
        <Select
          name="objective"
          defaultValue={objective ?? "all"}
          items={{ all: "Todos los objetivos", ...SEARCH_OBJECTIVE_LABELS }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los objetivos</SelectItem>
            {SEARCH_OBJECTIVES.map((o) => (
              <SelectItem key={o} value={o}>
                {SEARCH_OBJECTIVE_LABELS[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          name="urgency"
          defaultValue={urgency ?? "all"}
          items={{ all: "Toda urgencia", ...SEARCH_URGENCY_LABELS }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda urgencia</SelectItem>
            {SEARCH_URGENCIES.map((u) => (
              <SelectItem key={u} value={u}>
                {SEARCH_URGENCY_LABELS[u]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          name="status"
          defaultValue={status ?? "all"}
          items={{ all: "Todos los estados", ...SEARCH_STATUS_LABELS }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {SEARCH_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SEARCH_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {searches.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">Todavía no tenés búsquedas.</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Creá una búsqueda para empezar a registrar qué necesita cada
            cliente.
          </p>
          <Button render={<Link href="/searches/new" />} nativeButton={false}>
            <Plus />
            Nueva búsqueda
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última interacción</TableHead>
                <TableHead>Próxima acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searches.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/searches/${s.id}`}
                      className="hover:underline"
                    >
                      {s.contact_first_name} {s.contact_last_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.objective ? SEARCH_OBJECTIVE_LABELS[s.objective] : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.property_types.length > 0
                      ? s.property_types
                          .map((t) => PROPERTY_TYPE_LABELS[t])
                          .join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.cities.length > 0 ? s.cities.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatBudget(s.min_price, s.max_price, s.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {SEARCH_STATUS_LABELS[s.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatEventDay(s.last_interaction_at) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(s.next_action_at) ?? "—"}
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
