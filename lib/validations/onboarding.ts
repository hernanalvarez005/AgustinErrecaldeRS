import { z } from "zod";

export const CURRENCIES = ["ARS", "USD"] as const;

export const onboardingSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá tu nombre."),
  lastName: z.string().trim().min(1, "Ingresá tu apellido."),
  businessName: z.string().trim().min(1, "Ingresá un nombre comercial."),
  phone: z.string().trim().min(1, "Ingresá un teléfono de contacto."),
  mainArea: z.string().trim().min(1, "Ingresá tu zona principal de trabajo."),
  currency: z.enum(CURRENCIES),
  timezone: z.string().trim().min(1),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
