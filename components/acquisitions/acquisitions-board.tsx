"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { KanbanBoard, type KanbanAcquisition } from "./kanban-board";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { formatDate } from "@/lib/format";
import { acquisitionStatusTone } from "@/lib/status-tone";
import {
  ACQUISITION_STATUS_LABELS,
  ACQUISITION_STATUSES,
} from "@/lib/validations/acquisition";
import { CONTACT_SOURCE_LABELS } from "@/lib/validations/contact";
import type { AcquisitionStatus } from "@/types/database.types";

export type Acquisition = KanbanAcquisition & {
  origin: keyof typeof CONTACT_SOURCE_LABELS | null;
};

/**
 * Client-side filter + view switch for /acquisitions (Bloque UI-5, spec
 * point 50 — filter toolbar). Filters in memory instead of a server
 * round-trip: `listAcquisitions` already loads every row for the org (no
 * pagination) with property/owner resolved, and `acquisition_overview`
 * doesn't flatten property title / owner name (see the view's own SQL
 * comment) — adding those columns just to support a server-side `ilike`
 * would be a schema change this Bloque doesn't need. Everything needed for
 * search already sits in the array the page already fetched.
 */
export function AcquisitionsBoard({
  acquisitions,
  view,
}: {
  acquisitions: Acquisition[];
  view: "kanban" | "table";
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AcquisitionStatus | "all">("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return acquisitions.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (!term) return true;
      const haystack = [
        a.property?.title,
        a.owner ? `${a.owner.first_name} ${a.owner.last_name}` : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [acquisitions, search, status]);

  const hasActiveFilters = search.trim() !== "" || status !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por propiedad o propietario..."
          className="max-w-xs"
        />
        {view === "table" ? (
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as AcquisitionStatus | "all")
            }
            items={{ all: "Todas las fases", ...ACQUISITION_STATUS_LABELS }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fases</SelectItem>
              {ACQUISITION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ACQUISITION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("all");
            }}
            className="text-muted-foreground text-sm hover:underline"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Ninguna captación coincide con el filtro.
        </p>
      ) : view === "kanban" ? (
        <KanbanBoard acquisitions={filtered} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Propietario</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Valor estimado</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Último contacto</TableHead>
                <TableHead>Próxima acción</TableHead>
                <TableHead>Pendientes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
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
                    {a.origin ? CONTACT_SOURCE_LABELS[a.origin] : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {a.estimated_value
                      ? a.estimated_value.toLocaleString("es-AR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={acquisitionStatusTone(a.status)}>
                      {ACQUISITION_STATUS_LABELS[a.status]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(a.last_interaction_at) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(a.next_action_at) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {a.pending_tasks_count > 0 ? a.pending_tasks_count : "—"}
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
