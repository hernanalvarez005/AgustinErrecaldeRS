/**
 * Strips a phone number down to digits-only, the format `wa.me` requires
 * (spec V2.2 punto 1: "quitar espacios; quitar guiones; quitar paréntesis;
 * conservar código internacional"). Returns `null` if nothing usable is
 * left (empty string, or a value with no digits at all — e.g. garbage
 * text in a free-form field) rather than building a broken link.
 *
 * Argentina gotcha (spec punto 1 — "para Argentina validar correctamente
 * +54 cuando corresponda"): a number written and dialed as
 * "+54 11 1234-5678" needs to become "5491112345678" for `wa.me` — WITH a
 * `9` right after the `54` country code — even though that `9` is never
 * dialed domestically and isn't part of how anyone writes the number.
 * Without it, WhatsApp frequently fails to resolve the chat for Argentine
 * mobile numbers. There's no way to know the area code's exact length
 * (2-4 digits) from the digits alone, so the same heuristic every
 * Argentine WhatsApp link generator uses applies here: if the cleaned
 * digits start with the country code `54` and don't already have the `9`
 * marker right after it, insert one.
 *
 * This never writes back to `contacts.phone`/`contacts.whatsapp` — the
 * stored value is never modified, only read and transformed at the
 * moment a `wa.me` URL is built ("no modificar el teléfono almacenado
 * automáticamente si no existe certeza sobre su formato").
 */
export function normalizePhoneForWhatsApp(rawPhone: string): string | null {
  const digits = rawPhone.replace(/[^0-9]/g, "");
  if (!digits) return null;

  if (digits.startsWith("54") && !digits.startsWith("549")) {
    return `549${digits.slice(2)}`;
  }
  return digits;
}

/**
 * Builds a `wa.me` deep link, optionally with a prefilled message (spec
 * punto 3 — reusable for future actions like "Compartir propiedad" or
 * "Confirmar visita", not implemented yet, just the helper). Returns
 * `null` when the phone has no usable digits, so callers can render a
 * disabled state instead of a dead link.
 */
export function toWhatsAppLink(phone: string, message?: string): string | null {
  const digits = normalizePhoneForWhatsApp(phone);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
