import "server-only";

import { createClient } from "@/lib/supabase/server";

const VISIT_TYPES = ["property_visit", "acquisition_visit"] as const;

const FEEDBACK_COLUMNS =
  "id, activity_id, interest_level, positive_feedback, negative_feedback, price_perception, wants_to_proceed, notes";

export type PropertyVisitFeedback = Awaited<
  ReturnType<typeof getVisitFeedbackForProperty>
>[number];

/**
 * Every visit-with-feedback for a property, most recent first — shown on
 * the property's ficha, "Visitas" tab (V2 bloque D). Two queries instead
 * of an embedded join (activities → visit_feedback): consistent with how
 * the rest of lib/data/* avoids N+1 without relying on PostgREST's
 * embedded-resource filter syntax, which nothing else in this app uses.
 */
export async function getVisitFeedbackForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data: visits, error: visitsError } = await supabase
    .from("activities")
    .select("id, starts_at, contact_id")
    .eq("property_id", propertyId)
    .in("type", VISIT_TYPES)
    .order("starts_at", { ascending: false });
  if (visitsError) {
    console.error(
      "Failed to load visits for property feedback:",
      visitsError.message,
    );
    return [];
  }
  if (visits.length === 0) return [];

  const { data: feedback, error: feedbackError } = await supabase
    .from("visit_feedback")
    .select(FEEDBACK_COLUMNS)
    .in(
      "activity_id",
      visits.map((v) => v.id),
    );
  if (feedbackError) {
    console.error(
      "Failed to load visit feedback for property:",
      feedbackError.message,
    );
    return [];
  }

  const contactIds = [
    ...new Set(
      visits.map((v) => v.contact_id).filter((v): v is string => Boolean(v)),
    ),
  ];
  const contactById = new Map<
    string,
    { first_name: string; last_name: string }
  >();
  if (contactIds.length > 0) {
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .in("id", contactIds);
    if (contactsError) {
      console.error(
        "Failed to load contacts for visit feedback:",
        contactsError.message,
      );
    } else {
      for (const c of contacts) contactById.set(c.id, c);
    }
  }

  const feedbackByActivity = new Map(feedback.map((f) => [f.activity_id, f]));

  return visits
    .filter((v) => feedbackByActivity.has(v.id))
    .map((v) => ({
      ...feedbackByActivity.get(v.id)!,
      starts_at: v.starts_at,
      contact: v.contact_id ? (contactById.get(v.contact_id) ?? null) : null,
    }));
}

/** Every visit-with-feedback for a contact, most recent first — shown on the contact's ficha, "Visitas" card (V2 bloque D). */
export async function getVisitFeedbackForContact(contactId: string) {
  const supabase = await createClient();
  const { data: visits, error: visitsError } = await supabase
    .from("activities")
    .select("id, starts_at, property_id")
    .eq("contact_id", contactId)
    .in("type", VISIT_TYPES)
    .order("starts_at", { ascending: false });
  if (visitsError) {
    console.error(
      "Failed to load visits for contact feedback:",
      visitsError.message,
    );
    return [];
  }
  if (visits.length === 0) return [];

  const { data: feedback, error: feedbackError } = await supabase
    .from("visit_feedback")
    .select(FEEDBACK_COLUMNS)
    .in(
      "activity_id",
      visits.map((v) => v.id),
    );
  if (feedbackError) {
    console.error(
      "Failed to load visit feedback for contact:",
      feedbackError.message,
    );
    return [];
  }

  const propertyIds = [
    ...new Set(
      visits.map((v) => v.property_id).filter((v): v is string => Boolean(v)),
    ),
  ];
  const propertyById = new Map<string, string>();
  if (propertyIds.length > 0) {
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id, title")
      .in("id", propertyIds);
    if (propertiesError) {
      console.error(
        "Failed to load properties for visit feedback:",
        propertiesError.message,
      );
    } else {
      for (const p of properties) propertyById.set(p.id, p.title);
    }
  }

  const feedbackByActivity = new Map(feedback.map((f) => [f.activity_id, f]));

  return visits
    .filter((v) => feedbackByActivity.has(v.id))
    .map((v) => ({
      ...feedbackByActivity.get(v.id)!,
      starts_at: v.starts_at,
      property_title: v.property_id
        ? (propertyById.get(v.property_id) ?? null)
        : null,
    }));
}
