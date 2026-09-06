/**
 * `FormData.get(name)` returns `null` when the field isn't present in the
 * form at all (not just when a text input is empty, which gives `""`) — a
 * real bug we hit with an optional field that had no matching `<input>`.
 * Treat both the same so `z.string().optional()` accepts either.
 */
export const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;
