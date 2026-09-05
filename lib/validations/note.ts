import { z } from "zod";

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Escribí algo antes de guardar la nota."),
});
