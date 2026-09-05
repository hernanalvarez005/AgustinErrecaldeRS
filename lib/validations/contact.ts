import { z } from "zod";

import type { ContactRole, ContactSource } from "@/types/database.types";

export const CONTACT_ROLES: ContactRole[] = [
  "buyer",
  "seller",
  "owner",
  "investor",
  "tenant",
  "landlord",
  "referrer",
  "past_client",
  "other",
];

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  buyer: "Comprador",
  seller: "Vendedor",
  owner: "Propietario",
  investor: "Inversor",
  tenant: "Inquilino",
  landlord: "Locador",
  referrer: "Referidor",
  past_client: "Ex-cliente",
  other: "Otro",
};

export const CONTACT_SOURCES: ContactSource[] = [
  "whatsapp",
  "instagram",
  "zonaprop",
  "argenprop",
  "mercadolibre",
  "remax",
  "referral",
  "sign",
  "web",
  "own_database",
  "other",
];

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  zonaprop: "ZonaProp",
  argenprop: "Argenprop",
  mercadolibre: "MercadoLibre",
  remax: "RE/MAX",
  referral: "Referido",
  sign: "Cartel",
  web: "Web",
  own_database: "Base propia",
  other: "Otro",
};

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá el nombre."),
  lastName: z.string().trim().min(1, "Ingresá el apellido."),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  whatsapp: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  email: z.preprocess(emptyToUndefined, z.email("Email inválido.").optional()),
  dni: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  birthDate: z.preprocess(emptyToUndefined, z.string().optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  profession: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  source: z.preprocess(emptyToUndefined, z.enum(CONTACT_SOURCES).optional()),
  roles: z.array(z.enum(CONTACT_ROLES)).default([]),
});

export type ContactInput = z.infer<typeof contactSchema>;

export function parseRolesField(formData: FormData): ContactRole[] {
  return formData
    .getAll("roles")
    .filter((value): value is ContactRole =>
      CONTACT_ROLES.includes(value as ContactRole),
    );
}
