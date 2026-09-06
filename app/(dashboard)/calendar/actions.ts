"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { businessDateTimeToUtcIso } from "@/lib/date";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  type GoogleEventInput,
} from "@/lib/google/calendar";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_TYPE_LABELS } from "@/lib/validations/activity";
import {
  calendarEventSchema,
  CALENDAR_EVENT_STATUSES,
} from "@/lib/validations/calendar";
import { visitFeedbackSchema } from "@/lib/validations/visit-feedback";
import type { ActivityStatus, ActivityType } from "@/types/database.types";

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000; // Google requires an end; default to 1h when the advisor didn't set one.

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

function toGoogleEventInput(
  type: ActivityType,
  description: string | undefined,
  location: string | undefined,
  startsAtUtc: string,
  endsAtUtc: string | null,
): GoogleEventInput {
  return {
    summary: ACTIVITY_TYPE_LABELS[type],
    description,
    location,
    startIso: startsAtUtc,
    endIso:
      endsAtUtc ??
      new Date(
        new Date(startsAtUtc).getTime() + DEFAULT_EVENT_DURATION_MS,
      ).toISOString(),
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

  const startsAtUtc = businessDateTimeToUtcIso(parsed.data.startsAt);
  const endsAtUtc = parsed.data.endsAt
    ? businessDateTimeToUtcIso(parsed.data.endsAt)
    : null;

  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from("activities")
    .insert({
      organization_id: membership.organization.id,
      type: parsed.data.type,
      description: parsed.data.description ?? null,
      starts_at: startsAtUtc,
      ends_at: endsAtUtc,
      status: parsed.data.status,
      location: parsed.data.location ?? null,
      meeting_url: parsed.data.meetingUrl ?? null,
      contact_id: parsed.data.contactId ?? null,
      property_id: parsed.data.propertyId ?? null,
      deal_id: parsed.data.dealId ?? null,
    })
    .select("id")
    .single();

  if (error || !event) {
    console.error("Failed to create event:", error?.message);
    failCreate("No pudimos agendar el evento. Intentá nuevamente.");
  }

  // Google Calendar sync is one-directional and best-effort (Fase 9,
  // docs/ROADMAP.md): only "scheduled" events get mirrored, and a Google
  // API hiccup never blocks the CRM record, which stays the source of
  // truth — createGoogleCalendarEvent already swallows its own errors and
  // returns null when there's no connection or the call failed.
  if (parsed.data.status === "scheduled") {
    const googleEventId = await createGoogleCalendarEvent(
      toGoogleEventInput(
        parsed.data.type,
        parsed.data.description,
        parsed.data.location,
        startsAtUtc,
        endsAtUtc,
      ),
    );
    if (googleEventId) {
      const { error: linkError } = await supabase
        .from("activities")
        .update({ google_event_id: googleEventId })
        .eq("id", event.id);
      if (linkError)
        console.error("Failed to save Google event id:", linkError.message);
    }
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

  const startsAtUtc = businessDateTimeToUtcIso(parsed.data.startsAt);
  const endsAtUtc = parsed.data.endsAt
    ? businessDateTimeToUtcIso(parsed.data.endsAt)
    : null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("activities")
    .select("google_event_id")
    .eq("id", eventId)
    .single();

  const { error } = await supabase
    .from("activities")
    .update({
      type: parsed.data.type,
      description: parsed.data.description ?? null,
      starts_at: startsAtUtc,
      ends_at: endsAtUtc,
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

  const existingGoogleEventId = existing?.google_event_id ?? null;
  if (parsed.data.status === "cancelled") {
    if (existingGoogleEventId) {
      await deleteGoogleCalendarEvent(existingGoogleEventId);
      await supabase
        .from("activities")
        .update({ google_event_id: null })
        .eq("id", eventId);
    }
  } else {
    const googleInput = toGoogleEventInput(
      parsed.data.type,
      parsed.data.description,
      parsed.data.location,
      startsAtUtc,
      endsAtUtc,
    );
    if (existingGoogleEventId) {
      await updateGoogleCalendarEvent(existingGoogleEventId, googleInput);
    } else {
      const googleEventId = await createGoogleCalendarEvent(googleInput);
      if (googleEventId) {
        await supabase
          .from("activities")
          .update({ google_event_id: googleEventId })
          .eq("id", eventId);
      }
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/today");
  redirect(`/calendar?date=${parsed.data.startsAt.slice(0, 10)}`);
}

export async function updateEventStatus(eventId: string, status: string) {
  await requireMembership();
  if (!CALENDAR_EVENT_STATUSES.includes(status as ActivityStatus)) return;

  const supabase = await createClient();

  if (status === "cancelled") {
    const { data: existing } = await supabase
      .from("activities")
      .select("google_event_id")
      .eq("id", eventId)
      .single();
    if (existing?.google_event_id) {
      await deleteGoogleCalendarEvent(existing.google_event_id);
    }
  }

  const { error } = await supabase
    .from("activities")
    .update({
      status: status as ActivityStatus,
      google_event_id: status === "cancelled" ? null : undefined,
    })
    .eq("id", eventId);
  if (error) console.error("Failed to update event status:", error.message);

  revalidatePath("/calendar");
  revalidatePath("/today");
}

/**
 * "Finalizar visita" (V2 bloque D): marks the visit's activity completed
 * and saves its feedback in one step — the two are never split, an
 * advisor closing out a visit shouldn't have to remember a second action.
 * Optionally creates a follow-up task carrying the same context
 * (contact/property/etc.) as the visit itself, same "no separate task
 * system" rule as everywhere else in the app.
 */
export async function finalizeVisit(
  activityId: string,
  formData: FormData,
): Promise<{ error: string } | void> {
  const membership = await requireMembership();
  const parsed = visitFeedbackSchema.safeParse({
    interestLevel: formData.get("interestLevel"),
    positiveFeedback: formData.get("positiveFeedback"),
    negativeFeedback: formData.get("negativeFeedback"),
    pricePerception: formData.get("pricePerception"),
    wantsToProceed: formData.get("wantsToProceed"),
    notes: formData.get("notes"),
    followUpTitle: formData.get("followUpTitle"),
    followUpDueAt: formData.get("followUpDueAt"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    };
  }

  const supabase = await createClient();
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select(
      "id, contact_id, property_id, acquisition_id, search_id, lead_id, deal_id",
    )
    .eq("id", activityId)
    .single();
  if (activityError || !activity) {
    console.error(
      "Failed to load activity for visit feedback:",
      activityError?.message,
    );
    return { error: "No pudimos encontrar la visita. Intentá nuevamente." };
  }

  const { error: statusError } = await supabase
    .from("activities")
    .update({ status: "completed" })
    .eq("id", activityId);
  if (statusError) {
    console.error("Failed to complete visit activity:", statusError.message);
  }

  const { error: feedbackError } = await supabase.from("visit_feedback").upsert(
    {
      organization_id: membership.organization.id,
      activity_id: activityId,
      interest_level: parsed.data.interestLevel ?? null,
      positive_feedback: parsed.data.positiveFeedback ?? null,
      negative_feedback: parsed.data.negativeFeedback ?? null,
      price_perception: parsed.data.pricePerception ?? null,
      wants_to_proceed: parsed.data.wantsToProceed ?? null,
      notes: parsed.data.notes ?? null,
    },
    { onConflict: "activity_id" },
  );
  if (feedbackError) {
    console.error("Failed to save visit feedback:", feedbackError.message);
    return { error: "No pudimos guardar el feedback. Intentá nuevamente." };
  }

  if (parsed.data.followUpTitle) {
    const { error: taskError } = await supabase.from("tasks").insert({
      organization_id: membership.organization.id,
      title: parsed.data.followUpTitle,
      due_at: parsed.data.followUpDueAt
        ? new Date(parsed.data.followUpDueAt).toISOString()
        : null,
      contact_id: activity.contact_id,
      property_id: activity.property_id,
      acquisition_id: activity.acquisition_id,
      search_id: activity.search_id,
      lead_id: activity.lead_id,
      deal_id: activity.deal_id,
    });
    if (taskError) {
      console.error(
        "Failed to create visit follow-up task:",
        taskError.message,
      );
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/today");
  if (activity.contact_id) revalidatePath(`/contacts/${activity.contact_id}`);
  if (activity.property_id)
    revalidatePath(`/properties/${activity.property_id}`);
}
