import { Plus } from "lucide-react";
import Link from "next/link";

import { updateEventStatus } from "@/app/(dashboard)/calendar/actions";
import { MonthGrid } from "@/components/calendar/month-grid";
import { VisitFeedbackDialog } from "@/components/activities/visit-feedback-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/auth/session";
import { listEventsInRange, type CalendarEvent } from "@/lib/data/calendar";
import {
  addDaysToYmd,
  getBusinessRangeBoundsUtc,
  getMonthGridYmds,
  getWeekYmds,
  todayYmdInBusinessTimezone,
  utcIsoToBusinessDateTimeLocal,
} from "@/lib/date";
import { ACTIVITY_TYPE_LABELS } from "@/lib/validations/activity";
import { CALENDAR_EVENT_STATUS_LABELS } from "@/lib/validations/calendar";

type ViewMode = "month" | "week" | "day";

function eventYmd(startsAtUtc: string): string {
  return utcIsoToBusinessDateTimeLocal(startsAtUtc).slice(0, 10);
}

function eventTime(startsAtUtc: string): string {
  return utcIsoToBusinessDateTimeLocal(startsAtUtc).slice(11, 16);
}

function labelForYmd(ymd: string, options: Intl.DateTimeFormatOptions) {
  // Noon UTC is safe from any day-shift regardless of viewer/server
  // timezone, and we always pass timeZone: "UTC" below — this is a pure
  // calendar-date label, not a real instant (see lib/date.ts doc comment).
  const label = new Date(`${ymd}T12:00:00.000Z`).toLocaleDateString("es-AR", {
    ...options,
    timeZone: "UTC",
  });
  // Capitalize only the first letter — es-AR month/weekday names come back
  // lowercase, and CSS `capitalize` would wrongly title-case every word,
  // including "de" in phrases like "6 de septiembre" → "6 De Septiembre".
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className="flex items-start gap-3 rounded-md border p-2 text-sm">
      <span className="text-muted-foreground w-12 shrink-0 tabular-nums">
        {eventTime(event.starts_at)}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/calendar/${event.id}/edit`}
          className="font-medium hover:underline"
        >
          {ACTIVITY_TYPE_LABELS[event.type]}
        </Link>
        {event.link ? (
          <span className="text-muted-foreground"> · {event.link.label}</span>
        ) : null}
        {event.status !== "scheduled" ? (
          <Badge variant="secondary" className="ml-2">
            {CALENDAR_EVENT_STATUS_LABELS[event.status]}
          </Badge>
        ) : null}
        {event.description ? (
          <p className="text-muted-foreground">{event.description}</p>
        ) : null}
        {event.location ? (
          <p className="text-muted-foreground">📍 {event.location}</p>
        ) : null}
      </div>
      {event.status === "scheduled" ? (
        <div className="flex shrink-0 gap-1">
          {event.type === "property_visit" ||
          event.type === "acquisition_visit" ? (
            <VisitFeedbackDialog activityId={event.id} />
          ) : (
            <form action={updateEventStatus.bind(null, event.id, "completed")}>
              <Button type="submit" size="sm" variant="ghost">
                Completar
              </Button>
            </form>
          )}
          <form action={updateEventStatus.bind(null, event.id, "cancelled")}>
            <Button type="submit" size="sm" variant="ghost">
              Cancelar
            </Button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const params = await searchParams;
  const view: ViewMode =
    params.view === "week" ? "week" : params.view === "day" ? "day" : "month";
  const date =
    typeof params.date === "string" && params.date
      ? params.date
      : todayYmdInBusinessTimezone();
  const today = todayYmdInBusinessTimezone();

  const membership = await requireMembership();
  const [year, month] = date.split("-").map(Number);

  let gridYmds: string[];
  let rangeEndExclusive: string;
  let prevHref: string;
  let nextHref: string;
  let headerLabel: string;

  if (view === "month") {
    gridYmds = getMonthGridYmds(year, month);
    rangeEndExclusive = addDaysToYmd(gridYmds[gridYmds.length - 1], 1);
    const prevMonthDate =
      month === 1
        ? `${year - 1}-12-01`
        : `${year}-${String(month - 1).padStart(2, "0")}-01`;
    const nextMonthDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    prevHref = `/calendar?view=month&date=${prevMonthDate}`;
    nextHref = `/calendar?view=month&date=${nextMonthDate}`;
    headerLabel = labelForYmd(`${date.slice(0, 7)}-15`, {
      month: "long",
      year: "numeric",
    });
  } else if (view === "week") {
    gridYmds = getWeekYmds(date);
    rangeEndExclusive = addDaysToYmd(gridYmds[6], 1);
    prevHref = `/calendar?view=week&date=${addDaysToYmd(date, -7)}`;
    nextHref = `/calendar?view=week&date=${addDaysToYmd(date, 7)}`;
    headerLabel = `${labelForYmd(gridYmds[0], { day: "numeric", month: "short" })} – ${labelForYmd(gridYmds[6], { day: "numeric", month: "short", year: "numeric" })}`;
  } else {
    gridYmds = [date];
    rangeEndExclusive = addDaysToYmd(date, 1);
    prevHref = `/calendar?view=day&date=${addDaysToYmd(date, -1)}`;
    nextHref = `/calendar?view=day&date=${addDaysToYmd(date, 1)}`;
    headerLabel = labelForYmd(date, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  const { startUtc, endUtc } = getBusinessRangeBoundsUtc(
    gridYmds[0],
    rangeEndExclusive,
  );
  const events = await listEventsInRange(
    membership.organization.id,
    startUtc,
    endUtc,
  );

  const eventsByYmd = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const ymd = eventYmd(event.starts_at);
    const bucket = eventsByYmd.get(ymd);
    if (bucket) bucket.push(event);
    else eventsByYmd.set(ymd, [event]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {headerLabel}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border p-1">
            {(["month", "week", "day"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? "default" : "ghost"}
                render={<Link href={`/calendar?view=${v}&date=${date}`} />}
                nativeButton={false}
              >
                {v === "month" ? "Mes" : v === "week" ? "Semana" : "Día"}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            render={<Link href={prevHref} />}
            nativeButton={false}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/calendar?view=${view}&date=${today}`} />}
            nativeButton={false}
          >
            Hoy
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<Link href={nextHref} />}
            nativeButton={false}
          >
            Siguiente
          </Button>
          <Button
            render={<Link href={`/calendar/new?date=${date}`} />}
            nativeButton={false}
          >
            <Plus />
            Evento
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid
          gridYmds={gridYmds}
          eventsByYmd={eventsByYmd}
          currentMonth={month}
          today={today}
        />
      ) : (
        <div className="space-y-6">
          {gridYmds.map((ymd) => {
            const dayEvents = eventsByYmd.get(ymd) ?? [];
            return (
              <div key={ymd} className="space-y-2">
                {view === "week" ? (
                  <h2 className="text-sm font-medium">
                    {labelForYmd(ymd, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                    {ymd === today ? (
                      <Badge variant="secondary" className="ml-2">
                        Hoy
                      </Badge>
                    ) : null}
                  </h2>
                ) : null}
                {dayEvents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin eventos.</p>
                ) : (
                  <ul className="space-y-2">
                    {dayEvents.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
