import { z } from "zod";

export const passwordSignInSchema = z.object({
  email: z.email("Ingresá un email válido."),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export const passwordSignUpSchema = passwordSignInSchema;

export const magicLinkSchema = z.object({
  email: z.email("Ingresá un email válido."),
});
