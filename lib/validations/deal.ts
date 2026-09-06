import { z } from "zod";

import { emptyToUndefined } from "@/lib/validations/shared";
import type { DealStatus } from "@/types/database.types";

export const DEAL_STATUSES: DealStatus[] = [
  "negotiation",
  "offer",
  "reservation",
  "documentation",
  "contract",
  "closing",
  "closed",
  "cancelled",
];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  negotiation: "Negociación",
  offer: "Oferta",
  reservation: "Reserva",
  documentation: "Documentación",
  contract: "Contrato",
  closing: "Escrituración",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

// Column order for the Kanban board. `cancelled` is deliberately last — a
// terminal state you drag into, not a step in the middle of the flow. Same
// criterion as ACQUISITION_KANBAN_COLUMNS.
export const DEAL_KANBAN_COLUMNS: DealStatus[] = [
  "negotiation",
  "offer",
  "reservation",
  "documentation",
  "contract",
  "closing",
  "closed",
  "cancelled",
];

const numberOrUndefined = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined
      ? undefined
      : Number(value),
  z.number().optional(),
);

const currencyOrUndefined = z.preprocess(
  emptyToUndefined,
  z.enum(["ARS", "USD"]).optional(),
);

/** /deals/new — property, buyer and seller are fixed for the life of the deal (see actions.ts). */
export const dealSchema = z.object({
  propertyId: z.string().trim().min(1, "Elegí la propiedad."),
  buyerContactId: z.string().trim().min(1, "Elegí el comprador."),
  sellerContactId: z.string().trim().min(1, "Elegí el vendedor."),
  dealType: z.enum(["sale", "rent", "temporary_rent"]).default("sale"),
  askingPrice: numberOrUndefined,
  currency: currencyOrUndefined,
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type DealInput = z.infer<typeof dealSchema>;

/** Editing terms/milestones on an existing deal — everything here can change as the negotiation progresses. */
export const dealTermsSchema = z.object({
  offerPrice: numberOrUndefined,
  agreedPrice: numberOrUndefined,
  currency: currencyOrUndefined,
  reservationDate: z.preprocess(emptyToUndefined, z.string().optional()),
  contractDate: z.preprocess(emptyToUndefined, z.string().optional()),
  closingDate: z.preprocess(emptyToUndefined, z.string().optional()),
  estimatedCommission: numberOrUndefined,
  commissionCurrency: currencyOrUndefined,
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type DealTermsInput = z.infer<typeof dealTermsSchema>;
