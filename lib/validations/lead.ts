import { z } from "zod";

import { CONTACT_SOURCES } from "@/lib/validations/contact";
import { emptyToUndefined } from "@/lib/validations/shared";
import type { LeadStatus } from "@/types/database.types";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "not_interested",
  "unresponsive",
  "lost",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  converted: "Convertido",
  not_interested: "No interesado",
  unresponsive: "Sin respuesta",
  lost: "Perdido",
};

export const leadSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá el nombre."),
  lastName: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  email: z.preprocess(emptyToUndefined, z.email("Email inválido.").optional()),
  message: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  source: z.preprocess(emptyToUndefined, z.enum(CONTACT_SOURCES).optional()),
  propertyId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type LeadInput = z.infer<typeof leadSchema>;
