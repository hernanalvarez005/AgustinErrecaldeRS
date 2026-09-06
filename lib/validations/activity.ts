import { z } from "zod";

import type { ActivityType } from "@/types/database.types";

// The quick-log actions exposed from contact/property/acquisition pages.
// The remaining enum values (notary_meeting, reservation, contract_signing,
// closing) are set by the deals pipeline (Fase 6) once it exists — those are
// milestones a deal moves through, not something you log ad hoc.
export const LOGGABLE_ACTIVITY_TYPES: ActivityType[] = [
  "call",
  "whatsapp",
  "email",
  "meeting",
  "property_visit",
  "acquisition_visit",
  "valuation",
  "follow_up",
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
