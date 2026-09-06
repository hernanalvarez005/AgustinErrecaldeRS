import { z } from "zod";

import { emptyToUndefined } from "@/lib/validations/shared";
import type {
  VisitInterestLevel,
  VisitPricePerception,
  VisitWantsToProceed,
} from "@/types/database.types";

export const VISIT_INTEREST_LEVELS: VisitInterestLevel[] = [
  "very_interested",
  "interested",
  "unsure",
  "discarded",
];

export const VISIT_INTEREST_LEVEL_LABELS: Record<VisitInterestLevel, string> = {
  very_interested: "Muy interesado",
  interested: "Interesado",
  unsure: "Dudoso",
  discarded: "Descartado",
};

export const VISIT_PRICE_PERCEPTIONS: VisitPricePerception[] = [
  "low",
  "fair",
  "high",
];

export const VISIT_PRICE_PERCEPTION_LABELS: Record<
  VisitPricePerception,
  string
> = {
  low: "Bajo",
  fair: "Adecuado",
  high: "Alto",
};

export const VISIT_WANTS_TO_PROCEED_OPTIONS: VisitWantsToProceed[] = [
  "yes",
  "no",
  "thinking",
];

export const VISIT_WANTS_TO_PROCEED_LABELS: Record<
  VisitWantsToProceed,
  string
> = {
  yes: "Sí",
  no: "No",
  thinking: "Pensarlo",
};

export const visitFeedbackSchema = z.object({
  interestLevel: z.preprocess(
    emptyToUndefined,
    z.enum(VISIT_INTEREST_LEVELS).optional(),
  ),
  positiveFeedback: z.preprocess(
    emptyToUndefined,
    z.string().trim().optional(),
  ),
  negativeFeedback: z.preprocess(
    emptyToUndefined,
    z.string().trim().optional(),
  ),
  pricePerception: z.preprocess(
    emptyToUndefined,
    z.enum(VISIT_PRICE_PERCEPTIONS).optional(),
  ),
  wantsToProceed: z.preprocess(
    emptyToUndefined,
    z.enum(VISIT_WANTS_TO_PROCEED_OPTIONS).optional(),
  ),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  // "Crear seguimiento" antes de finalizar (spec V2 bloque D) — opcional,
  // solo crea la task si el asesor cargó un título.
  followUpTitle: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  followUpDueAt: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type VisitFeedbackInput = z.infer<typeof visitFeedbackSchema>;
