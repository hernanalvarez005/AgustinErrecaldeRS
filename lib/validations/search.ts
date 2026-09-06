import { z } from "zod";

import { emptyToUndefined } from "@/lib/validations/shared";
import { PROPERTY_TYPES } from "@/lib/validations/property";
import type {
  SearchObjective,
  SearchStatus,
  SearchUrgency,
} from "@/types/database.types";

export const SEARCH_STATUSES: SearchStatus[] = [
  "new",
  "qualified",
  "searching",
  "options_sent",
  "visiting",
  "negotiating",
  "reserved",
  "closed",
  "paused",
  "lost",
];

export const SEARCH_STATUS_LABELS: Record<SearchStatus, string> = {
  new: "Nueva",
  qualified: "Calificada",
  searching: "Buscando",
  options_sent: "Opciones enviadas",
  visiting: "Visitas",
  negotiating: "Negociación",
  reserved: "Reserva",
  closed: "Cerrada",
  paused: "Pausada",
  lost: "Perdida",
};

export const SEARCH_OBJECTIVES: SearchObjective[] = [
  "primary_residence",
  "investment",
  "traditional_rent",
  "temporary_rent",
  "relocation",
  "liquidity_need",
  "inheritance",
  "separation",
  "city_change",
  "portfolio_expansion",
  "other",
];

export const SEARCH_OBJECTIVE_LABELS: Record<SearchObjective, string> = {
  primary_residence: "Vivienda propia",
  investment: "Inversión",
  traditional_rent: "Renta tradicional",
  temporary_rent: "Alquiler temporal",
  relocation: "Mudanza",
  liquidity_need: "Necesidad de liquidez",
  inheritance: "Sucesión",
  separation: "Separación/divorcio",
  city_change: "Cambio de ciudad",
  portfolio_expansion: "Expansión patrimonial",
  other: "Otro",
};

export const SEARCH_URGENCIES: SearchUrgency[] = ["high", "medium", "low"];

export const SEARCH_URGENCY_LABELS: Record<SearchUrgency, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const numberOrUndefined = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined
      ? undefined
      : Number(value),
  z.number().optional(),
);

function parseListField(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export const searchSchema = z
  .object({
    contactId: z.string().trim().min(1, "Elegí el cliente."),
    operationType: z.enum(["sale", "rent", "temporary_rent"]).default("sale"),
    propertyTypes: z.array(z.enum(PROPERTY_TYPES)).default([]),
    minPrice: numberOrUndefined,
    maxPrice: numberOrUndefined,
    currency: z.preprocess(emptyToUndefined, z.enum(["ARS", "USD"]).optional()),
    cities: z.array(z.string()).default([]),
    neighborhoods: z.array(z.string()).default([]),
    minBedrooms: numberOrUndefined,
    maxBedrooms: numberOrUndefined,
    objective: z.preprocess(
      emptyToUndefined,
      z.enum(SEARCH_OBJECTIVES).optional(),
    ),
    urgency: z.preprocess(
      emptyToUndefined,
      z.enum(SEARCH_URGENCIES).optional(),
    ),
    financingRequired: z.boolean().default(false),
    status: z.enum(SEARCH_STATUSES).default("new"),
    notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  })
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    {
      message: "El precio mínimo no puede ser mayor al máximo.",
      path: ["maxPrice"],
    },
  );

export type SearchInput = z.infer<typeof searchSchema>;
export { parseListField };
