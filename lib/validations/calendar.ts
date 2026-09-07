import { z } from "zod";

import { emptyToUndefined } from "@/lib/validations/shared";
import { LOGGABLE_ACTIVITY_TYPES } from "@/lib/validations/activity";
import type { ActivityStatus } from "@/types/database.types";

export const CALENDAR_EVENT_STATUSES: ActivityStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
];

export const CALENDAR_EVENT_STATUS_LABELS: Record<ActivityStatus, string> = {
  scheduled: "Agendado",
  completed: "Realizado",
  cancelled: "Cancelado",
};

export const calendarEventSchema = z
  .object({
    type: z.enum(LOGGABLE_ACTIVITY_TYPES),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    // Raw "YYYY-MM-DDTHH:mm" from <input type="datetime-local"> — converted
    // to a UTC instant with lib/date.ts's businessDateTimeToUtcIso, never
    // with new Date(...) directly (see that function's doc comment).
    startsAt: z.string().min(1, "Elegí fecha y hora de inicio."),
    endsAt: z.preprocess(emptyToUndefined, z.string().optional()),
    location: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    meetingUrl: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    status: z.enum(CALENDAR_EVENT_STATUSES).default("scheduled"),
    contactId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    propertyId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    dealId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  })
  .refine((data) => !data.endsAt || data.endsAt >= data.startsAt, {
    message: "La hora de fin no puede ser anterior al inicio.",
    path: ["endsAt"],
  });

export type CalendarEventInput = z.infer<typeof calendarEventSchema>;

/**
 * "Vincular"/"Convertir en actividad CRM" on an imported external event
 * (V2.2 Bloque 8, spec punto 27): pick a type and, optionally, any of the
 * five entities the spec names — same "no exactly-one constraint" as the
 * rest of `activities` (a visit is routinely both a contact AND a
 * property, see calendarEventSchema above).
 */
export const linkExternalEventSchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  contactId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  propertyId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  searchId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  acquisitionId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  dealId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type LinkExternalEventInput = z.infer<typeof linkExternalEventSchema>;
