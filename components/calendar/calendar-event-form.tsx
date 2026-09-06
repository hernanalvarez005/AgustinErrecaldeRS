import { OptionalEntitySelectField } from "@/components/shared/optional-entity-select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { utcIsoToBusinessDateTimeLocal } from "@/lib/date";
import {
  ACTIVITY_TYPE_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
} from "@/lib/validations/activity";
import {
  CALENDAR_EVENT_STATUS_LABELS,
  CALENDAR_EVENT_STATUSES,
} from "@/lib/validations/calendar";
import type { Activity } from "@/types/database.types";

type EntityOption = { id: string; label: string };

export function CalendarEventForm({
  event,
  contacts,
  properties,
  deals,
  defaultStartsAt,
  defaultContactId,
  defaultPropertyId,
  defaultDealId,
  action,
}: {
  event?: Activity;
  contacts: EntityOption[];
  properties: EntityOption[];
  deals: EntityOption[];
  /** "YYYY-MM-DDTHH:mm" to prefill when creating (e.g. from clicking a day). */
  defaultStartsAt?: string;
  /** Preselect an entity when creating (e.g. arriving from "+ Agendar" on a contact/propiedad/operación page). */
  defaultContactId?: string;
  defaultPropertyId?: string;
  defaultDealId?: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Select
            name="type"
            defaultValue={event?.type ?? LOGGABLE_ACTIVITY_TYPES[0]}
            items={Object.fromEntries(
              LOGGABLE_ACTIVITY_TYPES.map((t) => [t, ACTIVITY_TYPE_LABELS[t]]),
            )}
          >
            <SelectTrigger id="type" className="w-full">
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
        {event ? (
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select
              name="status"
              defaultValue={event.status}
              items={CALENDAR_EVENT_STATUS_LABELS}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALENDAR_EVENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CALENDAR_EVENT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <input type="hidden" name="status" value="scheduled" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startsAt">Inicio</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={
              event
                ? utcIsoToBusinessDateTimeLocal(event.starts_at)
                : defaultStartsAt
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">Fin (opcional)</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={
              event?.ends_at ? utcIsoToBusinessDateTimeLocal(event.ends_at) : ""
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactId">Contacto</Label>
          <OptionalEntitySelectField
            id="contactId"
            name="contactId"
            options={contacts}
            defaultValue={event?.contact_id ?? defaultContactId}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="propertyId">Propiedad</Label>
          <OptionalEntitySelectField
            id="propertyId"
            name="propertyId"
            options={properties}
            defaultValue={event?.property_id ?? defaultPropertyId}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dealId">Operación</Label>
          <OptionalEntitySelectField
            id="dealId"
            name="dealId"
            options={deals}
            defaultValue={event?.deal_id ?? defaultDealId}
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Ubicación</Label>
          <Input
            id="location"
            name="location"
            defaultValue={event?.location ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meetingUrl">Link de reunión</Label>
          <Input
            id="meetingUrl"
            name="meetingUrl"
            defaultValue={event?.meeting_url ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={event?.description ?? ""}
        />
      </div>

      <Button type="submit">
        {event ? "Guardar cambios" : "Agendar evento"}
      </Button>
    </form>
  );
}
