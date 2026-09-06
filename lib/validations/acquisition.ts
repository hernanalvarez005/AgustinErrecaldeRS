import { z } from "zod";

import { CONTACT_SOURCES } from "@/lib/validations/contact";
import { PROPERTY_TYPES } from "@/lib/validations/property";
import { emptyToUndefined } from "@/lib/validations/shared";
import type { AcquisitionStatus } from "@/types/database.types";

export const ACQUISITION_STATUSES: AcquisitionStatus[] = [
  "new_lead",
  "contacted",
  "meeting_scheduled",
  "meeting_completed",
  "valuation",
  "proposal_sent",
  "follow_up",
  "won",
  "lost",
];

export const ACQUISITION_STATUS_LABELS: Record<AcquisitionStatus, string> = {
  new_lead: "Nuevo",
  contacted: "Contactado",
  meeting_scheduled: "Reunión agendada",
  meeting_completed: "Reunión realizada",
  valuation: "Tasación",
  proposal_sent: "Propuesta enviada",
  follow_up: "Seguimiento",
  won: "Captada",
  lost: "Perdida",
};

// Column order for the Kanban board. `lost` is deliberately last — it's a
// terminal state you drag into, not a step in the middle of the flow.
export const ACQUISITION_KANBAN_COLUMNS: AcquisitionStatus[] = [
  "new_lead",
  "contacted",
  "meeting_scheduled",
  "meeting_completed",
  "valuation",
  "proposal_sent",
  "follow_up",
  "won",
  "lost",
];

const numberOrUndefined = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined
      ? undefined
      : Number(value),
  z.number().optional(),
);

export const acquisitionSchema = z.object({
  contactId: z.string().trim().min(1, "Elegí el propietario."),
  // A minimal property is created together with the acquisition — see
  // docs/PRODUCT_SPEC.md on why the flow starts from "owner interested in
  // selling" rather than requiring a property to exist first.
  propertyTitle: z
    .string()
    .trim()
    .min(1, "Ingresá un título para la propiedad."),
  city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  neighborhood: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  origin: z.preprocess(emptyToUndefined, z.enum(CONTACT_SOURCES).optional()),
  estimatedValue: numberOrUndefined,
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type AcquisitionInput = z.infer<typeof acquisitionSchema>;

/**
 * "Captación rápida" (V2 bloque B): the minimal field set to register an
 * opportunity in under 30 seconds — no property/owner has to already
 * exist. `addressReference` doubles as the property's (required) `title`,
 * same as `acquisitionSchema.propertyTitle` — the field is just named for
 * what an advisor actually has in hand at this point (an address or a
 * rough reference, not a polished listing title yet).
 */
export const quickAcquisitionSchema = z.object({
  ownerFirstName: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre del propietario."),
  ownerLastName: z
    .string()
    .trim()
    .min(1, "Ingresá el apellido del propietario."),
  ownerPhone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  addressReference: z
    .string()
    .trim()
    .min(1, "Ingresá una dirección o referencia."),
  propertyType: z.preprocess(
    emptyToUndefined,
    z.enum(PROPERTY_TYPES).optional(),
  ),
  estimatedValue: numberOrUndefined,
  origin: z.preprocess(emptyToUndefined, z.enum(CONTACT_SOURCES).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type QuickAcquisitionInput = z.infer<typeof quickAcquisitionSchema>;
