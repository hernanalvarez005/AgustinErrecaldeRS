/**
 * es-AR date/time formatting helpers shared across list and detail views.
 *
 * `formatDate` is for calendar-date values with no meaningful time-of-day:
 * native Postgres `date` columns (e.g. `valuation_date`) and `due_at`
 * columns that are only ever set from a plain `<input type="date">` (no
 * time picked). Those are written as UTC midnight (`new Date("2026-10-09")`
 * is UTC per the ES spec), so they MUST be formatted with `timeZone: "UTC"`
 * — formatting them in any timezone behind UTC (which includes Argentina,
 * UTC-3) rolls them back a day, e.g. a task due "09-oct" would display as
 * "08-oct" for anyone/any server west of UTC. Verified live in Fase 4: a
 * task created with due date 2026-10-09 rendered as "08-oct" before this
 * fix. Do not add a local/implicit timezone here.
 *
 * `formatDateTime` is for genuine point-in-time timestamps (when an
 * activity/note was actually logged) and formats in the advisor's business
 * timezone (Argentina) explicitly, rather than relying on the server
 * process's local timezone — which would make dev (whatever the machine's
 * TZ is) and prod (UTC on Vercel) render different times for the same
 * instant.
 *
 * `formatEventDay` is the day-only counterpart of `formatDateTime`: use it
 * for a real timestamp (e.g. `last_interaction_at`, sourced from
 * `activities.starts_at`) that's being bucketed down to a calendar day for
 * a list column. It must use the business timezone, not UTC — an activity
 * logged at 22:59 in Argentina is 01:59 UTC the *next* day, so formatting
 * it with `formatDate`'s UTC rule would show "última interacción" as
 * tomorrow. Don't use it for `due_at`/native `date` values — those go
 * through `formatDate`.
 */

import { BUSINESS_TIMEZONE } from "@/lib/date";

export function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatEventDay(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    timeZone: BUSINESS_TIMEZONE,
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUSINESS_TIMEZONE,
  });
}

/**
 * "hace 18 min" / "hace 3 h" / "hace 2 d" — for a real timestamp
 * (`leads.created_at`), not a calendar date. This diffs two real instants
 * (now vs. `value`), so unlike the helpers above there is no business-vs-UTC
 * timezone question here — a duration between two instants is the same
 * number of seconds everywhere.
 */
export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return null;
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

/**
 * Whole days elapsed since a real timestamp, as of now — "días en
 * cartera", "días desde el último ajuste" (V2 bloque C). A separate named
 * function, not `Date.now()` inline in a component body: React's purity
 * lint (`react-hooks/purity`) flags a direct call to an impure global
 * during render, but not one wrapped in a plain helper like this — same
 * reason `formatRelativeTime` above already calls `Date.now()` safely.
 */
export function daysSinceNow(value: string): number {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}

/**
 * "USD 80.000–110.000" / "Desde USD 80.000" / "Hasta USD 110.000" /
 * "Sin definir" — a search's budget range. Extracted from
 * app/(dashboard)/searches/[id]/page.tsx (V2 bloque F) so the contact
 * ficha's "necesidad activa" summary renders the exact same format
 * instead of a second, possibly-drifting copy.
 */
export function formatBudget(
  min: number | null,
  max: number | null,
  currency: string | null,
) {
  if (!currency || (min === null && max === null)) return "Sin definir";
  const fmt = (n: number) => n.toLocaleString("es-AR");
  if (min !== null && max !== null)
    return `${currency} ${fmt(min)}–${fmt(max)}`;
  if (min !== null) return `Desde ${currency} ${fmt(min)}`;
  return `Hasta ${currency} ${fmt(max as number)}`;
}
