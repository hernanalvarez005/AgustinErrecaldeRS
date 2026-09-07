"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { KanbanBoard, type KanbanDeal } from "./kanban-board";
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
import { dealStatusTone } from "@/lib/status-tone";
import { DEAL_STATUS_LABELS, DEAL_STATUSES } from "@/lib/validations/deal";
import type { DealStatus } from "@/types/database.types";

export type Deal = KanbanDeal & {
  seller: { first_name: string; last_name: string } | null;
};

function formatPrice(value: number | null, currency: "ARS" | "USD" | null) {
  if (!value || !currency) return "—";
  return `${currency} ${value.toLocaleString("es-AR")}`;
}

/**
 * Client-side filter + view switch for /deals — twin of
 * components/acquisitions/acquisitions-board.tsx, same rationale (in-memory
 * filter, no server round-trip, no schema change to deal_overview).
 */
export function DealsBoard({
  deals,
  view,
}: {
  deals: Deal[];
  view: "kanban" | "table";
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DealStatus | "all">("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!term) return true;
      const haystack = [
        d.property?.title,
        d.buyer ? `${d.buyer.first_name} ${d.buyer.last_name}` : null,
        d.seller ? `${d.seller.first_name} ${d.seller.last_name}` : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [deals, search, status]);

  const hasActiveFilters = search.trim() !== "" || status !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por propiedad, comprador o vendedor..."
          className="max-w-xs"
        />
        {view === "table" ? (
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as DealStatus | "all")}
            items={{ all: "Todos los estados", ...DEAL_STATUS_LABELS }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {DEAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {DEAL_STATUS_LABELS[s]}
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
          Ninguna operación coincide con el filtro.
        </p>
      ) : view === "kanban" ? (
        <KanbanBoard deals={filtered} />
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
              {filtered.map((d) => (
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
                    <StatusBadge tone={dealStatusTone(d.status)}>
                      {DEAL_STATUS_LABELS[d.status]}
                    </StatusBadge>
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
