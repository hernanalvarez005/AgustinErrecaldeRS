"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { businessDateTimeToUtcIso } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import {
  calendarEventSchema,
  CALENDAR_EVENT_STATUSES,
} from "@/lib/validations/calendar";
import type { ActivityStatus } from "@/types/database.types";

function eventFieldsFromFormData(formData: FormData) {
  // "none" is OptionalEntitySelectField's explicit sentinel for "no entity"
  // (a real SelectItem, not an unset placeholder — see
  // docs/ARCHITECTURE.md, Base UI single-item Select gotcha). Normalize it
  // to "" here so calendarEventSchema's emptyToUndefined treats it as absent.
  const orNone = (value: FormDataEntryValue | null) =>
    value === "none" ? "" : value;
  return {
    type: formData.get("type"),
    description: formData.get("description"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    location: formData.get("location"),
    meetingUrl: formData.get("meetingUrl"),
    status: formData.get("status") || undefined,
    contactId: orNone(formData.get("contactId")),
    propertyId: orNone(formData.get("propertyId")),
    dealId: orNone(formData.get("dealId")),
  };
}

function failCreate(message: string): never {
  redirect(`/calendar/new?error=${encodeURIComponent(message)}`);
}

function failUpdate(eventId: string, message: string): never {
  redirect(`/calendar/${eventId}/edit?error=${encodeURIComponent(message)}`);
}

export async function createEvent(formData: FormData) {
  const membership = await requireMembership();
  const parsed = calendarEventSchema.safeParse(
    eventFieldsFromFormData(formData),
  );
  if (!parsed.success) {
    console.error("Invalid event input:", parsed.error.issues);
    failCreate(
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    organization_id: membership.organization.id,
    type: parsed.data.type,
    description: parsed.data.description ?? null,
    starts_at: businessDateTimeToUtcIso(parsed.data.startsAt),
    ends_at: parsed.data.endsAt
      ? businessDateTimeToUtcIso(parsed.data.endsAt)
      : null,
    status: parsed.data.status,
    location: parsed.data.location ?? null,
    meeting_url: parsed.data.meetingUrl ?? null,
    contact_id: parsed.data.contactId ?? null,
    property_id: parsed.data.propertyId ?? null,
    deal_id: parsed.data.dealId ?? null,
  });

  if (error) {
    console.error("Failed to create event:", error.message);
    failCreate("No pudimos agendar el evento. Intentá nuevamente.");
  }

  revalidatePath("/calendar");
  revalidatePath("/today");
  redirect(`/calendar?date=${parsed.data.startsAt.slice(0, 10)}`);
}

export async function updateEvent(eventId: string, formData: FormData) {
  await requireMembership();
  const parsed = calendarEventSchema.safeParse(
    eventFieldsFromFormData(formData),
  );
  if (!parsed.success) {
    console.error("Invalid event input:", parsed.error.issues);
    failUpdate(
      eventId,
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("activities")
    .update({
      type: parsed.data.type,
      description: parsed.data.description ?? null,
      starts_at: businessDateTimeToUtcIso(parsed.data.startsAt),
      ends_at: parsed.data.endsAt
        ? businessDateTimeToUtcIso(parsed.data.endsAt)
        : null,
      status: parsed.data.status,
      location: parsed.data.location ?? null,
      meeting_url: parsed.data.meetingUrl ?? null,
      contact_id: parsed.data.contactId ?? null,
      property_id: parsed.data.propertyId ?? null,
      deal_id: parsed.data.dealId ?? null,
    })
    .eq("id", eventId);

  if (error) {
    console.error("Failed to update event:", error.message);
    failUpdate(eventId, "No pudimos guardar los cambios. Intentá nuevamente.");
  }

  revalidatePath("/calendar");
  revalidatePath("/today");
  redirect(`/calendar?date=${parsed.data.startsAt.slice(0, 10)}`);
}

export async function updateEventStatus(eventId: string, status: string) {
  await requireMembership();
  if (!CALENDAR_EVENT_STATUSES.includes(status as ActivityStatus)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("activities")
    .update({ status: status as ActivityStatus })
    .eq("id", eventId);
  if (error) console.error("Failed to update event status:", error.message);

  revalidatePath("/calendar");
  revalidatePath("/today");
}
