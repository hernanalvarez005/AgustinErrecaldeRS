"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useState, useTransition } from "react";

import { updateDealStatus } from "@/app/(dashboard)/deals/actions";
import { formatDate } from "@/lib/format";
import {
  DEAL_KANBAN_COLUMNS,
  DEAL_STATUS_LABELS,
} from "@/lib/validations/deal";
import type { DealStatus } from "@/types/database.types";

// Same three dnd-kit gotchas as components/acquisitions/kanban-board.tsx
// (docs/ARCHITECTURE.md) — applied from the start here instead of
// rediscovering them:
// - `POINTER_SENSOR_OPTIONS` as a stable module-level object (a fresh
//   literal every render breaks useSensor's internal memoization).
// - `DND_CONTEXT_ID` fixed instead of dnd-kit's auto-incrementing default,
//   which caused a real aria-describedby hydration mismatch across
//   client-side navigations.
// - `activationConstraint: { distance: 8 }` so a plain click on a card
//   isn't swallowed as a zero-distance drag.
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } };
const DND_CONTEXT_ID = "deals-kanban";

export type KanbanDeal = {
  id: string;
  status: DealStatus;
  asking_price: number | null;
  offer_price: number | null;
  agreed_price: number | null;
  currency: "ARS" | "USD" | null;
  next_action_at: string | null;
  property: { title: string } | null;
  buyer: { first_name: string; last_name: string } | null;
};

function formatPrice(deal: KanbanDeal) {
  const value = deal.agreed_price ?? deal.offer_price ?? deal.asking_price;
  if (!value || !deal.currency) return null;
  return `${deal.currency} ${value.toLocaleString("es-AR")}`;
}

function DealCard({ deal }: { deal: KanbanDeal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: deal.id });
  const price = formatPrice(deal);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              zIndex: 10,
            }
          : undefined
      }
      className={`bg-card space-y-1 rounded-lg border p-3 text-sm shadow-sm ${isDragging ? "opacity-50" : ""}`}
    >
      <Link href={`/deals/${deal.id}`} className="font-medium hover:underline">
        {deal.property?.title ?? "Propiedad sin título"}
      </Link>
      <p className="text-muted-foreground">
        {deal.buyer ? `${deal.buyer.first_name} ${deal.buyer.last_name}` : "—"}
      </p>
      {price ? <p className="text-muted-foreground">{price}</p> : null}
      {deal.next_action_at ? (
        <p className="text-muted-foreground">
          Próxima acción: {formatDate(deal.next_action_at)}
        </p>
      ) : null}
    </div>
  );
}

function KanbanColumn({
  status,
  deals,
}: {
  status: DealStatus;
  deals: KanbanDeal[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`bg-muted/30 flex w-64 shrink-0 flex-col gap-2 rounded-lg border p-2 ${
        isOver ? "ring-ring ring-2" : ""
      }`}
    >
      <div className="flex items-center justify-between px-1 pt-1">
        <h3 className="text-sm font-medium">{DEAL_STATUS_LABELS[status]}</h3>
        <span className="text-muted-foreground text-xs">{deals.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({ deals }: { deals: KanbanDeal[] }) {
  const [items, setItems] = useState(deals);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR_OPTIONS));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const newStatus = over.id as DealStatus;
    const dealId = active.id as string;
    const current = items.find((d) => d.id === dealId);
    if (!current || current.status === newStatus) return;

    setItems((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, status: newStatus } : d)),
    );
    startTransition(() => {
      updateDealStatus(dealId, newStatus);
    });
  }

  return (
    <DndContext id={DND_CONTEXT_ID} sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {DEAL_KANBAN_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            deals={items.filter((d) => d.status === status)}
          />
        ))}
      </div>
      <DragOverlay />
    </DndContext>
  );
}
