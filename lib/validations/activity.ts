import { z } from "zod";

import type { ActivityType } from "@/types/database.types";

// The quick-log actions exposed from a contact's page. The full type list
// (notary_meeting, closing, ...) is set by other flows (deals, acquisitions)
// once those exist — this is deliberately the "I did this with this person"
// subset, not the whole enum.
export const LOGGABLE_ACTIVITY_TYPES: ActivityType[] = [
  "call",
  "whatsapp",
  "email",
  "meeting",
  "property_visit",
  "other",
];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: "Llamada",
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Reunión",
  virtual_meeting: "Reunión virtual",
  property_visit: "Visita",
  acquisition_visit: "Visita de captación",
  valuation: "Tasación",
  notary_meeting: "Reunión con escribanía",
  reservation: "Reserva",
  contract_signing: "Firma de contrato",
  closing: "Cierre",
  follow_up: "Seguimiento",
  other: "Otro",
};

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const activitySchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});
