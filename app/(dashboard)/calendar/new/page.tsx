import { createEvent } from "@/app/(dashboard)/calendar/actions";
import { CalendarEventForm } from "@/components/calendar/calendar-event-form";
import { requireMembership } from "@/lib/auth/session";
import { listDealOptions } from "@/lib/data/deals";
import { listContactOptions, listPropertyOptions } from "@/lib/data/properties";
import { todayYmdInBusinessTimezone } from "@/lib/date";

export default async function NewCalendarEventPage({
  searchParams,
}: PageProps<"/calendar/new">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const date =
    typeof params.date === "string" && params.date
      ? params.date
      : todayYmdInBusinessTimezone();
  const contactId =
    typeof params.contactId === "string" ? params.contactId : undefined;
  const propertyId =
    typeof params.propertyId === "string" ? params.propertyId : undefined;
  const dealId = typeof params.dealId === "string" ? params.dealId : undefined;

  const membership = await requireMembership();
  const [contacts, properties, deals] = await Promise.all([
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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo evento</h1>
        <p className="text-muted-foreground text-sm">
          Llamada, reunión, visita — lo que necesites agendar.
        </p>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      <CalendarEventForm
        contacts={contacts}
        properties={properties}
        deals={deals}
        defaultStartsAt={`${date}T09:00`}
        defaultContactId={contactId}
        defaultPropertyId={propertyId}
        defaultDealId={dealId}
        action={createEvent}
      />
    </div>
  );
}
