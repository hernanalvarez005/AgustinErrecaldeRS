import { z } from "zod";

import { emptyToUndefined } from "@/lib/validations/shared";
import type { OfferStatus } from "@/types/database.types";

export const OFFER_STATUSES: OfferStatus[] = [
  "pending",
  "accepted",
  "rejected",
  "counter_offered",
  "withdrawn",
  "expired",
];

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  counter_offered: "Contraofertada",
  withdrawn: "Retirada",
  expired: "Vencida",
};

const numberRequired = z.preprocess(
  (value) => (value === "" || value === null ? undefined : Number(value)),
  z.number().positive("Ingresá un monto válido."),
);

export const offerSchema = z.object({
  contactId: z.string().trim().min(1, "Elegí el cliente."),
  amount: numberRequired,
  currency: z.enum(["ARS", "USD"]),
  conditions: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  expirationDate: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type OfferInput = z.infer<typeof offerSchema>;

/** Same fields as `offerSchema` minus `contactId` — a counteroffer stays with the same counterparty as the offer it responds to. */
export const counterOfferSchema = offerSchema.omit({ contactId: true });

export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
