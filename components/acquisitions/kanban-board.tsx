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

import { updateAcquisitionStatus } from "@/app/(dashboard)/acquisitions/actions";
import { formatDate } from "@/lib/format";
import {
  ACQUISITION_KANBAN_COLUMNS,
  ACQUISITION_STATUS_LABELS,
} from "@/lib/validations/acquisition";
import type { AcquisitionStatus } from "@/types/database.types";

// Stable references, defined once at module scope:
// - `POINTER_SENSOR_OPTIONS` as a fresh object literal on every render would
//   break useSensor's internal memoization, which triggered a real "final
//   argument changed size between renders" warning from dnd-kit.
// - `DND_CONTEXT_ID` replaces dnd-kit's own auto-incrementing id (used to
//   build the `aria-describedby` on each draggable). That counter starts
//   over at 0 on every server render but keeps climbing across client-side
//   navigations within the same session, producing a real, reproducible
//   hydration mismatch — not a testing artifact. A fixed id sidesteps it.
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } };
const DND_CONTEXT_ID = "acquisitions-kanban";

export type KanbanAcquisition = {
  id: string;
  status: AcquisitionStatus;
  estimated_value: number | null;
  next_action_at: string | null;
  last_interaction_at: string | null;
  pending_tasks_count: number;
  property: {
    title: string;
    city: string | null;
    neighborhood: string | null;
  } | null;
  owner: { first_name: string; last_name: string } | null;
};

function AcquisitionCard({ acquisition }: { acquisition: KanbanAcquisition }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: acquisition.id,
    });

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
      <Link
        href={`/acquisitions/${acquisition.id}`}
        className="font-medium hover:underline"
      >
        {acquisition.property?.title ?? "Propiedad sin título"}
      </Link>
      <p className="text-muted-foreground">
        {acquisition.owner
          ? `${acquisition.owner.first_name} ${acquisition.owner.last_name}`
          : "—"}
      </p>
      {acquisition.estimated_value ? (
        <p className="text-muted-foreground">
          Est. {acquisition.estimated_value.toLocaleString("es-AR")}
        </p>
      ) : null}
      {acquisition.last_interaction_at ? (
        <p className="text-muted-foreground">
          Último contacto: {formatDate(acquisition.last_interaction_at)}
        </p>
      ) : null}
      {acquisition.next_action_at ? (
        <p className="text-muted-foreground">
          Próxima acción: {formatDate(acquisition.next_action_at)}
        </p>
      ) : null}
      {acquisition.pending_tasks_count > 0 ? (
        <p className="text-muted-foreground">
          {acquisition.pending_tasks_count === 1
            ? "1 pendiente"
            : `${acquisition.pending_tasks_count} pendientes`}
        </p>
      ) : null}
    </div>
  );
}

function KanbanColumn({
  status,
  acquisitions,
}: {
  status: AcquisitionStatus;
  acquisitions: KanbanAcquisition[];
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
        <h3 className="text-sm font-medium">
          {ACQUISITION_STATUS_LABELS[status]}
        </h3>
        <span className="text-muted-foreground text-xs">
          {acquisitions.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {acquisitions.map((a) => (
          <AcquisitionCard key={a.id} acquisition={a} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({
  acquisitions,
}: {
  acquisitions: KanbanAcquisition[];
}) {
  const [items, setItems] = useState(acquisitions);
  const [, startTransition] = useTransition();
  // Without an activation constraint, PointerSensor treats a plain click as
  // a zero-distance drag and swallows the click event — the card's <Link>
  // never navigates. Requiring 8px of movement before a drag "starts" lets
  // an actual click pass through normally.
  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR_OPTIONS));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const newStatus = over.id as AcquisitionStatus;
    const acquisitionId = active.id as string;
    const current = items.find((a) => a.id === acquisitionId);
    if (!current || current.status === newStatus) return;

    setItems((prev) =>
      prev.map((a) =>
        a.id === acquisitionId ? { ...a, status: newStatus } : a,
      ),
    );
    startTransition(() => {
      updateAcquisitionStatus(acquisitionId, newStatus);
    });
  }

  return (
    <DndContext id={DND_CONTEXT_ID} sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {ACQUISITION_KANBAN_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            acquisitions={items.filter((a) => a.status === status)}
          />
        ))}
      </div>
      <DragOverlay />
    </DndContext>
  );
}
