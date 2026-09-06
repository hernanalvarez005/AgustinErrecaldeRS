import { notFound } from "next/navigation";

import { updateEvent } from "@/app/(dashboard)/calendar/actions";
import { CalendarEventForm } from "@/components/calendar/calendar-event-form";
import { getEvent } from "@/lib/data/calendar";
import { listDealOptions } from "@/lib/data/deals";
import { requireMembership } from "@/lib/auth/session";
import { listContactOptions, listPropertyOptions } from "@/lib/data/properties";

export default async function EditCalendarEventPage({
  params,
  searchParams,
}: PageProps<"/calendar/[id]/edit">) {
  const { id } = await params;
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;

  const membership = await requireMembership();
  const [event, contacts, properties, deals] = await Promise.all([
    getEvent(id),
    listContactOptions(membership.organization.id).then((rows) =>
      rows.map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}` })),
    ),
    listPropertyOptions(membership.organization.id).then((rows) =>
      rows.map((p) => ({ id: p.id, label: p.title })),
    ),
    listDealOptions(membership.organization.id).then((rows) =>
      rows.map((d) => ({ id: d.id, label: d.title })),
    ),
  ]);
  if (!event) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar evento</h1>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      <CalendarEventForm
        event={event}
        contacts={contacts}
        properties={properties}
        deals={deals}
        action={updateEvent.bind(null, event.id)}
      />
    </div>
  );
}
