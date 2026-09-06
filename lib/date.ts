/**
 * "Today" boundaries for the advisor's business timezone (Argentina),
 * computed independently of the server process's own local timezone (the
 * dev machine's TZ vs. Vercel/UTC in prod would otherwise disagree on when
 * "today" starts) — see docs/ARCHITECTURE.md, timezone gotcha.
 *
 * Two variants, matching the same split as lib/format.ts's
 * formatDate/formatEventDay:
 * - `getDateOnlyTodayBoundsUtc()`: for comparing against `due_at`/native
 *   `date` values that were written from a plain `<input type="date">` —
 *   those are anchored at UTC midnight, never at Argentina midnight (see
 *   formatDate's doc comment), so the boundaries here are UTC midnight of
 *   "today" in Argentina, matching how those values are written.
 * - `getBusinessTodayBoundsUtc()`: for comparing against real timestamps
 *   (`activities.starts_at`) against the advisor's actual wall-clock day —
 *   boundaries here are Argentina midnight (00:00 ART), expressed in UTC.
 *
 * Argentina has used a fixed UTC-3 offset with no daylight saving time
 * since 2009, so the offset below is a constant, not derived from Intl —
 * simpler and just as correct as computing it for a single-timezone MVP.
 */

const BUSINESS_TIMEZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_UTC_OFFSET_HOURS = 3; // Argentina local + 3h = UTC

function todayYmdInBusinessTimezone(): string {
  // en-CA formats as YYYY-MM-DD, which is what we need to build an ISO string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getDateOnlyTodayBoundsUtc(): {
  startUtc: string;
  endUtc: string;
} {
  const ymd = todayYmdInBusinessTimezone();
  const start = new Date(`${ymd}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export function getBusinessTodayBoundsUtc(): {
  startUtc: string;
  endUtc: string;
} {
  const ymd = todayYmdInBusinessTimezone();
  const start = new Date(`${ymd}T00:00:00.000Z`);
  start.setUTCHours(ARGENTINA_UTC_OFFSET_HOURS);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}
