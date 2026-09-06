/**
 * "Today"/"this month"/"this week" boundaries and calendar-grid arithmetic
 * for the advisor's business timezone (Argentina), computed independently
 * of the server process's own local timezone (the dev machine's TZ vs.
 * Vercel/UTC in prod would otherwise disagree on when "today" starts) —
 * see docs/ARCHITECTURE.md, timezone gotchas.
 *
 * Everything here works with plain "YYYY-MM-DD" strings and UTC-anchored
 * `Date` objects (via `getUTCFullYear`/`setUTCDate`/etc.) — never the
 * local-timezone getters/setters (`getDate`, `startOfMonth` from
 * `date-fns`, ...), which would silently reintroduce the same class of bug
 * depending on where the code runs. This is also why the calendar (Fase 8)
 * doesn't use the already-installed `date-fns`: it has no first-party
 * timezone support (that's a separate `@date-fns/tz` package we don't have),
 * so its `startOfMonth`/`startOfWeek`/etc. read the local wall-clock of
 * whatever `Date` you hand them — exactly the trap this file exists to
 * avoid. A UTC-anchored `Date` is a safe, unambiguous stand-in for a bare
 * calendar date (day-of-week, day arithmetic) as long as you only ever
 * read/write it with UTC getters/setters.
 *
 * Two boundary flavors, matching the split in lib/format.ts
 * (formatDate/formatEventDay):
 * - Day-only bounds (`getDateOnlyTodayBoundsUtc`): for comparing against
 *   `due_at`/native `date` values written from a plain `<input
 *   type="date">` — those are anchored at UTC midnight, never at
 *   Argentina midnight (see formatDate's doc comment).
 * - Business bounds (`getBusinessDayBoundsUtc`/`getBusinessRangeBoundsUtc`):
 *   for comparing against real timestamps (`activities.starts_at`) against
 *   the advisor's actual wall-clock day/week/month — bounds here are
 *   Argentina midnight (00:00 ART), expressed in UTC.
 *
 * Argentina has used a fixed UTC-3 offset with no daylight saving time
 * since 2009, so the offset below is a constant, not derived from Intl —
 * simpler and just as correct as computing it for a single-timezone MVP.
 */

export const BUSINESS_TIMEZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_UTC_OFFSET_HOURS = 3; // Argentina local + 3h = UTC

export function todayYmdInBusinessTimezone(): string {
  // en-CA formats as YYYY-MM-DD, which is what we need to build an ISO string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function utcMidnightToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds (or subtracts) whole days to a "YYYY-MM-DD" string, pure UTC arithmetic. */
export function addDaysToYmd(ymd: string, days: number): string {
  const d = ymdToUtcMidnight(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return utcMidnightToYmd(d);
}

/** 0 = Monday ... 6 = Sunday (the convention this calendar's grid uses). */
export function getWeekdayIndexMondayFirst(ymd: string): number {
  const jsDay = ymdToUtcMidnight(ymd).getUTCDay(); // 0 = Sunday ... 6 = Saturday
  return (jsDay + 6) % 7;
}

/** The 7 "YYYY-MM-DD" days (Monday→Sunday) of the week containing `ymd`. */
export function getWeekYmds(ymd: string): string[] {
  const monday = addDaysToYmd(ymd, -getWeekdayIndexMondayFirst(ymd));
  return Array.from({ length: 7 }, (_, i) => addDaysToYmd(monday, i));
}

/** How many days are in `month` (1-12) of `year`. */
export function daysInMonth(year: number, month: number): number {
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthFirst =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const days = Math.round(
    (ymdToUtcMidnight(nextMonthFirst).getTime() -
      ymdToUtcMidnight(firstOfMonth).getTime()) /
      86_400_000,
  );
  return days;
}

/**
 * The full grid of "YYYY-MM-DD" days for a month view: complete weeks
 * (Monday→Sunday) that together cover every day of `month` (1-12), padded
 * with the trailing days of the previous/next month so the grid is always
 * a multiple of 7.
 */
export function getMonthGridYmds(year: number, month: number): string[] {
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const leadingDays = getWeekdayIndexMondayFirst(firstOfMonth);
  const gridStart = addDaysToYmd(firstOfMonth, -leadingDays);
  const totalCells =
    Math.ceil((leadingDays + daysInMonth(year, month)) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) =>
    addDaysToYmd(gridStart, i),
  );
}

export function getDateOnlyTodayBoundsUtc(): {
  startUtc: string;
  endUtc: string;
} {
  const ymd = todayYmdInBusinessTimezone();
  const start = ymdToUtcMidnight(ymd);
  const end = ymdToUtcMidnight(addDaysToYmd(ymd, 1));
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

/** Argentina-midnight-to-midnight bounds (expressed in UTC) for the single day `ymd` (defaults to today). */
export function getBusinessDayBoundsUtc(
  ymd: string = todayYmdInBusinessTimezone(),
): { startUtc: string; endUtc: string } {
  return getBusinessRangeBoundsUtc(ymd, addDaysToYmd(ymd, 1));
}

/** Argentina-midnight-to-midnight bounds (expressed in UTC) for [startYmd, endYmdExclusive). */
export function getBusinessRangeBoundsUtc(
  startYmd: string,
  endYmdExclusive: string,
): { startUtc: string; endUtc: string } {
  const start = ymdToUtcMidnight(startYmd);
  start.setUTCHours(ARGENTINA_UTC_OFFSET_HOURS);
  const end = ymdToUtcMidnight(endYmdExclusive);
  end.setUTCHours(ARGENTINA_UTC_OFFSET_HOURS);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export type DashboardPeriod =
  "this_month" | "last_month" | "quarter" | "year" | "all";

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  this_month: "Este mes",
  last_month: "Mes pasado",
  quarter: "Último trimestre",
  year: "Este año",
  all: "Todo",
};

/**
 * The "YYYY-MM-DD" range for a dashboard period, in the business timezone.
 * `startYmd: null` means no lower bound (period "all"). Callers convert
 * this into UTC bounds with `getBusinessRangeBoundsUtc` for real
 * timestamps (`created_at`/`starts_at`), or compare `startYmd`/
 * `endYmdExclusive` directly for native `date` columns like
 * `deals.closing_date` — those need no UTC conversion at all, since
 * Postgres `date` values compare fine against a plain "YYYY-MM-DD" string.
 */
export function getPeriodYmdRange(period: DashboardPeriod): {
  startYmd: string | null;
  endYmdExclusive: string;
} {
  const today = todayYmdInBusinessTimezone();
  const [year, month] = today.split("-").map(Number);
  const endYmdExclusive = addDaysToYmd(today, 1); // through today, inclusive

  function firstOfMonth(y: number, m: number): string {
    return `${y}-${String(m).padStart(2, "0")}-01`;
  }
  function addMonths(y: number, m: number, delta: number): [number, number] {
    let ny = y;
    let nm = m + delta;
    while (nm < 1) {
      nm += 12;
      ny -= 1;
    }
    while (nm > 12) {
      nm -= 12;
      ny += 1;
    }
    return [ny, nm];
  }

  switch (period) {
    case "all":
      return { startYmd: null, endYmdExclusive };
    case "this_month":
      return { startYmd: firstOfMonth(year, month), endYmdExclusive };
    case "last_month": {
      const [ly, lm] = addMonths(year, month, -1);
      return {
        startYmd: firstOfMonth(ly, lm),
        endYmdExclusive: firstOfMonth(year, month),
      };
    }
    case "quarter": {
      const [qy, qm] = addMonths(year, month, -2); // last 3 months, current included
      return { startYmd: firstOfMonth(qy, qm), endYmdExclusive };
    }
    case "year":
      return { startYmd: `${year}-01-01`, endYmdExclusive };
  }
}

/**
 * Converts a `<input type="datetime-local">` value (e.g. "2026-09-10T15:30",
 * with no timezone info) into a correct UTC ISO instant — treating it as
 * the advisor's wall-clock time in Argentina, never as the local time of
 * whatever machine happens to run this code.
 *
 * This matters because a timezone-less date-*time* string follows the
 * OPPOSITE parsing rule from a bare date: `new Date("2026-09-10")` is UTC
 * (see formatDate's doc comment), but `new Date("2026-09-10T15:30")` is
 * LOCAL time per the ECMAScript spec. Passing a calendar form's raw value
 * straight to `new Date(...).toISOString()` would silently store the
 * wrong instant on any machine/deployment not set to Argentina's offset —
 * the write-side twin of the display-side gotcha in lib/format.ts.
 */
export function businessDateTimeToUtcIso(datetimeLocal: string): string {
  const [datePart, timePart] = datetimeLocal.split("T");
  const [hh = "00", mm = "00", ss = "00"] = (timePart ?? "").split(":");
  const utc = new Date(
    `${datePart}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}.000Z`,
  );
  utc.setUTCHours(utc.getUTCHours() + ARGENTINA_UTC_OFFSET_HOURS);
  return utc.toISOString();
}

/**
 * The inverse of `businessDateTimeToUtcIso`: formats a stored UTC instant
 * as a "YYYY-MM-DDTHH:mm" string in Argentina wall-clock time, suitable for
 * prefilling a `<input type="datetime-local">` when editing an existing
 * event. Safe to use `Intl` directly here (unlike the write direction)
 * since we're only reformatting an already-correct instant into the
 * target timezone, not constructing a new one from a naive string.
 */
export function utcIsoToBusinessDateTimeLocal(utcIso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcIso));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
