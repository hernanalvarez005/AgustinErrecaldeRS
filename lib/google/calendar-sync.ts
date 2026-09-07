import "server-only";

import { getAuthUser, getCurrentMembership } from "@/lib/auth/session";
import {
  listChangedGoogleCalendarEvents,
  type GoogleCalendarEventPayload,
} from "@/lib/google/calendar";
import { createClient } from "@/lib/supabase/server";

export type CalendarSyncResult =
  | {
      ok: true;
      imported: number;
      updated: number;
      cancelled: number;
      removed: number;
    }
  | { ok: false; error: string };

function eventStartIso(event: GoogleCalendarEventPayload): string | null {
  const start = event.start;
  if (!start) return null;
  if (start.dateTime) return start.dateTime;
  // All-day event ("date" only, no time) — store as UTC midnight, same
  // convention lib/format.ts documents for other date-only values.
  if (start.date) return `${start.date}T00:00:00.000Z`;
  return null;
}

function eventEndIso(
  event: GoogleCalendarEventPayload,
  startIso: string,
): string {
  const end = event.end;
  if (end?.dateTime) return end.dateTime;
  if (end?.date) return `${end.date}T00:00:00.000Z`;
  // Google always sends an end, but fall back to +1h rather than crash if
  // it ever doesn't — same default the CRM→Google direction already uses.
  return new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
}

/**
 * Pulls whatever changed on the current user's connected Google Calendar
 * since the last sync and applies it to `activities`, scoped to their
 * organization. Safe to call repeatedly (e.g. a "Sincronizar ahora"
 * button, spec V2.2 punto 30) — each run only processes what's actually
 * new since the stored `sync_token`.
 *
 * What it deliberately does NOT do (spec punto 25): never creates a
 * contact/lead/property/task from a Google event, and never touches the
 * existing contact_id/property_id/... link on a row that already has one
 * — only the schedule-ish fields (title/description/location/start/end)
 * and status get overwritten from Google's data.
 */
export async function syncGoogleCalendarEvents(): Promise<CalendarSyncResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "No hay una sesión activa." };

  const membership = await getCurrentMembership();
  if (!membership)
    return { ok: false, error: "No hay una organización activa." };

  const supabase = await createClient();
  const { data: connection, error: connectionError } = await supabase
    .from("google_calendar_connections")
    .select("sync_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connectionError) {
    console.error(
      "Failed to load Google Calendar connection for sync:",
      connectionError.message,
    );
    return { ok: false, error: "No pudimos leer la conexión con Google." };
  }
  if (!connection) {
    return { ok: false, error: "No tenés Google Calendar conectado." };
  }

  let result = await listChangedGoogleCalendarEvents(connection.sync_token);

  if (!result.ok && result.reason === "sync_token_invalid") {
    // Google's token expired/became invalid — the only recovery is a fresh
    // full sync (spec punto 26: "manejar expiración/invalidez del token
    // haciendo una nueva sincronización completa cuando sea necesario").
    result = await listChangedGoogleCalendarEvents(null);
  }

  if (!result.ok) {
    if (result.reason === "no_connection") {
      return { ok: false, error: "No tenés Google Calendar conectado." };
    }
    if (result.reason === "sync_token_invalid") {
      // Only reachable if the retried full sync above *also* came back
      // invalid, which Google's API shouldn't ever do for a syncToken-less
      // request — treated as a generic error rather than retrying forever.
      return {
        ok: false,
        error: "No pudimos sincronizar con Google Calendar. Probá de nuevo.",
      };
    }
    return { ok: false, error: result.message };
  }

  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  let removed = 0;

  for (const event of result.events) {
    const { data: existing, error: lookupError } = await supabase
      .from("activities")
      .select(
        "id, source, status, google_updated_at, contact_id, property_id, acquisition_id, search_id, deal_id",
      )
      .eq("organization_id", membership.organization.id)
      .eq("google_event_id", event.id)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "Failed to look up activity for Google event:",
        lookupError.message,
      );
      continue;
    }

    if (event.status === "cancelled") {
      if (!existing) continue; // a cancelled event we never had — nothing to do
      // "Linked" covers both a fully converted CRM activity (source='crm')
      // and a still-external event the advisor merely "Vinculó" (Bloque 8)
      // to a contact/property/search/acquisition/deal without converting
      // it — either way there's now a real CRM relation worth preserving,
      // so it must never be hard-deleted just because Google's copy went
      // away (spec punto 29).
      const isLinked =
        existing.source === "crm" ||
        Boolean(
          existing.contact_id ||
          existing.property_id ||
          existing.acquisition_id ||
          existing.search_id ||
          existing.deal_id,
        );
      if (!isLinked) {
        // Purely external, never linked to anything CRM-side — no history
        // worth keeping (spec punto 29: "un evento puramente externo
        // eliminado puede dejar de mostrarse/archivarse").
        const { error: deleteError } = await supabase
          .from("activities")
          .delete()
          .eq("id", existing.id);
        if (deleteError) {
          console.error(
            "Failed to remove externally-deleted activity:",
            deleteError.message,
          );
          continue;
        }
        removed++;
      } else if (existing.status !== "cancelled") {
        // CRM-linked event deleted on Google's side — mark cancelled, never
        // hard-delete (spec punto 29: preserva el historial).
        const { error: cancelError } = await supabase
          .from("activities")
          .update({
            status: "cancelled",
            google_updated_at: event.updated ?? null,
          })
          .eq("id", existing.id);
        if (cancelError) {
          console.error(
            "Failed to cancel Google-deleted activity:",
            cancelError.message,
          );
          continue;
        }
        cancelled++;
      }
      continue;
    }

    const startIso = eventStartIso(event);
    if (!startIso) continue; // no usable start time — nothing to import
    const endIso = eventEndIso(event, startIso);
    const title = event.summary?.trim() || null;
    const description = event.description?.trim() || null;
    const location = event.location?.trim() || null;

    if (existing) {
      // Already applied this exact version (most commonly: our own
      // CRM→Google push round-tripping back on the next sync) — skip the
      // no-op write rather than reprocess it.
      if (
        event.updated &&
        existing.google_updated_at &&
        new Date(event.updated).getTime() <=
          new Date(existing.google_updated_at).getTime()
      ) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("activities")
        .update({
          title,
          description,
          location,
          starts_at: startIso,
          ends_at: endIso,
          status: existing.status === "completed" ? "completed" : "scheduled",
          google_updated_at: event.updated ?? null,
        })
        .eq("id", existing.id);
      if (updateError) {
        console.error(
          "Failed to update activity from Google event:",
          updateError.message,
        );
        continue;
      }
      updated++;
    } else {
      // Brand-new external event — bare activities row, every linking FK
      // left null (spec punto 25: never auto-creates a contact/lead/
      // property/task). type "other" since Google events carry no concept
      // of this app's activity types; the real label is `title`.
      const { error: insertError } = await supabase.from("activities").insert({
        organization_id: membership.organization.id,
        type: "other",
        title,
        description,
        location,
        starts_at: startIso,
        ends_at: endIso,
        status: "scheduled",
        google_event_id: event.id,
        google_updated_at: event.updated ?? null,
        source: "google_calendar",
      });
      if (insertError) {
        console.error("Failed to import Google event:", insertError.message);
        continue;
      }
      imported++;
    }
  }

  const { error: saveTokenError } = await supabase
    .from("google_calendar_connections")
    .update({
      sync_token: result.nextSyncToken,
      last_synced_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (saveTokenError) {
    console.error("Failed to persist sync token:", saveTokenError.message);
  }

  return { ok: true, imported, updated, cancelled, removed };
}
