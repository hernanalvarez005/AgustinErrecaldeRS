import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const numberOrUndefined = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined
      ? undefined
      : Number(value),
  z.number().optional(),
);

export const valuationSchema = z
  .object({
    estimatedMinValue: numberOrUndefined,
    estimatedValue: numberOrUndefined,
    estimatedMaxValue: numberOrUndefined,
    currency: z.preprocess(emptyToUndefined, z.enum(["ARS", "USD"]).optional()),
    recommendedListingPrice: numberOrUndefined,
    valuationDate: z.preprocess(emptyToUndefined, z.string().optional()),
    notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  })
  .refine(
    (data) =>
      data.estimatedMinValue === undefined ||
      data.estimatedMaxValue === undefined ||
      data.estimatedMinValue <= data.estimatedMaxValue,
    {
      message: "El valor mínimo no puede ser mayor al máximo.",
      path: ["estimatedMaxValue"],
    },
  );

export type ValuationInput = z.infer<typeof valuationSchema>;
