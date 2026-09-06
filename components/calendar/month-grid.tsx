import Link from "next/link";

import type { CalendarEvent } from "@/lib/data/calendar";
import { utcIsoToBusinessDateTimeLocal } from "@/lib/date";
import { ACTIVITY_TYPE_LABELS } from "@/lib/validations/activity";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function eventTime(startsAtUtc: string): string {
  return utcIsoToBusinessDateTimeLocal(startsAtUtc).slice(11, 16);
}

export function MonthGrid({
  gridYmds,
  eventsByYmd,
  currentMonth,
  today,
}: {
  gridYmds: string[];
  eventsByYmd: Map<string, CalendarEvent[]>;
  /** 1-12, so cells outside this month render dimmed. */
  currentMonth: number;
  today: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="grid min-w-[840px] grid-cols-7">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-muted-foreground border-b p-2 text-center text-xs font-medium"
          >
            {label}
          </div>
        ))}
        {gridYmds.map((ymd) => {
          const dayEvents = eventsByYmd.get(ymd) ?? [];
          const isCurrentMonth = Number(ymd.slice(5, 7)) === currentMonth;
          const isToday = ymd === today;
          return (
            <div
              key={ymd}
              className={`min-h-28 space-y-1 border-r border-b p-1.5 last:border-r-0 ${
                isCurrentMonth ? "" : "bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/calendar?view=day&date=${ymd}`}
                  className={`flex size-6 items-center justify-center rounded-full text-xs hover:underline ${
                    isToday
                      ? "bg-foreground text-background font-medium"
                      : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {Number(ymd.slice(8, 10))}
                </Link>
                <Link
                  href={`/calendar/new?date=${ymd}`}
                  className="text-muted-foreground hover:text-foreground text-xs"
                  title="Nuevo evento"
                >
                  +
                </Link>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <Link
                    key={event.id}
                    href={`/calendar/${event.id}/edit`}
                    className={`block truncate rounded px-1 py-0.5 text-xs hover:underline ${
                      event.status === "cancelled"
                        ? "text-muted-foreground line-through"
                        : "bg-muted"
                    }`}
                    title={`${ACTIVITY_TYPE_LABELS[event.type]}${event.link ? ` · ${event.link.label}` : ""}`}
                  >
                    {eventTime(event.starts_at)}{" "}
                    {ACTIVITY_TYPE_LABELS[event.type]}
                  </Link>
                ))}
                {dayEvents.length > 3 ? (
                  <Link
                    href={`/calendar?view=day&date=${ymd}`}
                    className="text-muted-foreground block px-1 text-xs hover:underline"
                  >
                    +{dayEvents.length - 3} más
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
