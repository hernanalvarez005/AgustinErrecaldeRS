import { z } from "zod";

import type {
  OperationType,
  PropertyStatus,
  PropertyType,
} from "@/types/database.types";

export const PROPERTY_TYPES: PropertyType[] = [
  "apartment",
  "house",
  "ph",
  "land",
  "office",
  "commercial",
  "warehouse",
  "other",
];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Departamento",
  house: "Casa",
  ph: "PH",
  land: "Terreno",
  office: "Oficina",
  commercial: "Local comercial",
  warehouse: "Galpón/Depósito",
  other: "Otro",
};

export const OPERATION_TYPES: OperationType[] = [
  "sale",
  "rent",
  "temporary_rent",
];

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  sale: "Venta",
  rent: "Alquiler",
  temporary_rent: "Alquiler temporario",
};

export const PROPERTY_STATUSES: PropertyStatus[] = [
  "draft",
  "valuation",
  "capturing",
  "active",
  "reserved",
  "sold",
  "rented",
  "paused",
  "lost",
  "archived",
];

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Borrador",
  valuation: "Tasación",
  capturing: "Captando",
  active: "Activa",
  reserved: "Reservada",
  sold: "Vendida",
  rented: "Alquilada",
  paused: "Pausada",
  lost: "Perdida",
  archived: "Archivada",
};

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const numberOrUndefined = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined
      ? undefined
      : Number(value),
  z.number().optional(),
);

export const propertySchema = z
  .object({
    title: z.string().trim().min(1, "Ingresá un título para la propiedad."),
    propertyType: z.enum(PROPERTY_TYPES),
    operationType: z.enum(OPERATION_TYPES),
    status: z.enum(PROPERTY_STATUSES).default("draft"),

    street: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    streetNumber: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    neighborhood: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    province: z.preprocess(emptyToUndefined, z.string().trim().optional()),

    price: numberOrUndefined,
    currency: z.preprocess(emptyToUndefined, z.enum(["ARS", "USD"]).optional()),

    bedrooms: numberOrUndefined,
    bathrooms: numberOrUndefined,
    garageSpaces: numberOrUndefined,
    totalArea: numberOrUndefined,
    coveredArea: numberOrUndefined,
    expenses: numberOrUndefined,

    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  })
  .refine((data) => data.price === undefined || data.currency !== undefined, {
    message: "Si ingresás un precio, elegí la moneda.",
    path: ["currency"],
  });

export type PropertyInput = z.infer<typeof propertySchema>;
