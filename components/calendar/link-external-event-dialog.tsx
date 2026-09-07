"use client";

import { useState, useTransition } from "react";
import { LinkIcon } from "lucide-react";
import { toast } from "sonner";

import { linkExternalEvent } from "@/app/(dashboard)/calendar/actions";
import { OptionalEntitySelectField } from "@/components/shared/optional-entity-select-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ACTIVITY_TYPE_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
} from "@/lib/validations/activity";
import type { ActivityType } from "@/types/database.types";

type EntityOption = { id: string; label: string };

/**
 * "Vincular" / "Convertir en actividad CRM" on an imported external event
 * (V2.2 Bloque 8, spec punto 27). Both actions share the same fields —
 * "Vincular" just attaches an entity and keeps the row external/read-only
 * and sync-managed; "Convertir" additionally hands it over to the CRM's
 * normal edit/complete/cancel flow (source flips to `crm`). Neither ever
 * touches the event on Google's side — see the Server Action's own doc
 * comment for why.
 */
export function LinkExternalEventDialog({
  eventId,
  currentType,
  currentContactId,
  currentPropertyId,
  currentSearchId,
  currentAcquisitionId,
  currentDealId,
  isLinked,
  contacts,
  properties,
  searches,
  acquisitions,
  deals,
}: {
  eventId: string;
  currentType: ActivityType;
  currentContactId: string | null;
  currentPropertyId: string | null;
  currentSearchId: string | null;
  currentAcquisitionId: string | null;
  currentDealId: string | null;
  /** Already has at least one entity attached — changes the trigger label/copy. */
  isLinked: boolean;
  contacts: EntityOption[];
  properties: EntityOption[];
  searches: EntityOption[];
  acquisitions: EntityOption[];
  deals: EntityOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const convert = submitter?.value === "convert";
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await linkExternalEvent(eventId, convert, formData);
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        convert ? "Convertido en actividad CRM." : "Vínculo guardado.",
      );
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" variant="ghost" />}>
        <LinkIcon /> {isLinked ? "Editar vínculo" : "Vincular"}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Vincular evento de Google Calendar</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
        >
          <p className="text-muted-foreground text-sm">
            &ldquo;Vincular&rdquo; solo lo asocia — sigue siendo de solo lectura
            y se sigue actualizando desde Google. &ldquo;Convertir en actividad
            CRM&rdquo; lo convierte en una actividad editable normal (podés
            completarla o cancelarla desde el CRM).
          </p>

          <div className="space-y-2">
            <Label htmlFor="link-type">Tipo de actividad</Label>
            <Select
              name="type"
              defaultValue={currentType}
              items={Object.fromEntries(
                LOGGABLE_ACTIVITY_TYPES.map((t) => [
                  t,
                  ACTIVITY_TYPE_LABELS[t],
                ]),
              )}
            >
              <SelectTrigger id="link-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGGABLE_ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACTIVITY_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-contact">Cliente</Label>
            <OptionalEntitySelectField
              id="link-contact"
              name="contactId"
              options={contacts}
              defaultValue={currentContactId ?? undefined}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-property">Propiedad</Label>
            <OptionalEntitySelectField
              id="link-property"
              name="propertyId"
              options={properties}
              defaultValue={currentPropertyId ?? undefined}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-search">Búsqueda</Label>
            <OptionalEntitySelectField
              id="link-search"
              name="searchId"
              options={searches}
              defaultValue={currentSearchId ?? undefined}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-acquisition">Captación</Label>
            <OptionalEntitySelectField
              id="link-acquisition"
              name="acquisitionId"
              options={acquisitions}
              defaultValue={currentAcquisitionId ?? undefined}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-deal">Operación</Label>
            <OptionalEntitySelectField
              id="link-deal"
              name="dealId"
              options={deals}
              defaultValue={currentDealId ?? undefined}
              className="w-full"
            />
          </div>

          <SheetFooter className="flex-row px-0">
            <Button
              type="submit"
              name="intent"
              value="link"
              variant="outline"
              disabled={isPending}
              className="flex-1"
            >
              Vincular
            </Button>
            <Button
              type="submit"
              name="intent"
              value="convert"
              disabled={isPending}
              className="flex-1"
            >
              Convertir en actividad CRM
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
