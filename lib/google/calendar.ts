import "server-only";

import { getAuthUser } from "@/lib/auth/session";
import { refreshAccessToken } from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const TOKEN_REFRESH_SAFETY_MARGIN_MS = 60_000; // refresh a minute before it actually expires

/**
 * A valid access token for the current user's Google Calendar connection,
 * refreshing it first if it's expired (or about to be). Returns null if
 * the advisor hasn't connected Google Calendar — every function below
 * treats that as "nothing to sync," never as an error, since Google
 * Calendar sync is optional (docs/PRODUCT_SPEC.md).
 */
export async function getValidConnection(): Promise<{
  accessToken: string;
  calendarId: string;
} | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: connection, error } = await supabase
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expiry, calendar_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load Google Calendar connection:", error.message);
    return null;
  }
  if (!connection) return null;

  const expiresAt = new Date(connection.token_expiry).getTime();
  if (expiresAt - TOKEN_REFRESH_SAFETY_MARGIN_MS > Date.now()) {
    return {
      accessToken: connection.access_token,
      calendarId: connection.calendar_id,
    };
  }

  try {
    const { accessToken, expiresIn } = await refreshAccessToken(
      connection.refresh_token,
    );
    const { error: updateError } = await supabase
      .from("google_calendar_connections")
      .update({
        access_token: accessToken,
        token_expiry: new Date(Date.now() + expiresIn * 1000).toISOString(),
      })
      .eq("user_id", user.id);
    if (updateError) {
      console.error(
        "Failed to persist refreshed Google token:",
        updateError.message,
      );
    }
    return { accessToken, calendarId: connection.calendar_id };
  } catch (refreshError) {
    console.error(
      "Failed to refresh Google Calendar token:",
      refreshError instanceof Error ? refreshError.message : refreshError,
    );
    return null;
  }
}

export type GoogleEventInput = {
  summary: string;
  description?: string | null;
  location?: string | null;
  /** UTC ISO instant. */
  startIso: string;
  /** UTC ISO instant — Calendar API requires an end, so callers must supply one even for open-ended events. */
  endIso: string;
};

function toGoogleEventBody(input: GoogleEventInput) {
  return {
    summary: input.summary,
    description: input.description ?? undefined,
    location: input.location ?? undefined,
    start: { dateTime: input.startIso },
    end: { dateTime: input.endIso },
  };
}

async function callCalendarApi(
  method: string,
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${CALENDAR_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Creates the event on the advisor's connected Google Calendar. Returns
 * the Google event id to store in `activities.google_event_id`, or null
 * if there's no connection or the call failed — sync is one-directional
 * and best-effort: a Google API hiccup never blocks saving the CRM record,
 * which stays the source of truth (docs/ROADMAP.md, Fase 9).
 */
export async function createGoogleCalendarEvent(
  input: GoogleEventInput,
): Promise<string | null> {
  const connection = await getValidConnection();
  if (!connection) return null;

  try {
    const response = await callCalendarApi(
      "POST",
      `/calendars/${encodeURIComponent(connection.calendarId)}/events`,
      connection.accessToken,
      toGoogleEventBody(input),
    );
    if (!response.ok) {
      console.error(
        "Failed to create Google Calendar event, status:",
        response.status,
      );
      return null;
    }
    const data = await response.json();
    return typeof data.id === "string" ? data.id : null;
  } catch (error) {
    console.error(
      "Failed to create Google Calendar event:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function updateGoogleCalendarEvent(
  googleEventId: string,
  input: GoogleEventInput,
): Promise<boolean> {
  const connection = await getValidConnection();
  if (!connection) return false;

  try {
    const response = await callCalendarApi(
      "PATCH",
      `/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(googleEventId)}`,
      connection.accessToken,
      toGoogleEventBody(input),
    );
    if (!response.ok) {
      console.error(
        "Failed to update Google Calendar event, status:",
        response.status,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "Failed to update Google Calendar event:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

// --- Google → CRM incremental sync (V2.2 Bloque 6) -------------------------
//
// Everything below reads FROM Google; the functions above (create/update/
// delete) remain the only ones that write TO Google. Kept in this file
// rather than a separate module since they share `getValidConnection` and
// `callCalendarApi` and the whole point is "one place that talks to the
// Calendar API".

/** The subset of Google's Events resource this app actually reads. */
export type GoogleCalendarEventPayload = {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  updated?: string;
};

export type ListChangedEventsResult =
  | { ok: true; events: GoogleCalendarEventPayload[]; nextSyncToken: string }
  | { ok: false; reason: "no_connection" }
  | { ok: false; reason: "sync_token_invalid" }
  | { ok: false; reason: "error"; message: string };

// How far back a first-ever ("full") sync looks — a real estate advisor's
// agenda doesn't need years of history, and an unbounded pull risks
// dragging in a huge personal event backlog on first connect. Once this
// initial windowed sync hands back a nextSyncToken, every later call is
// incremental (no timeMin) and simply follows changes forward from there —
// Google ties a sync token to the filters used to obtain it, so this bound
// only ever applies once.
const FULL_SYNC_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * Pulls every event that changed since `syncToken` (or, when null, does a
 * bounded first-time sync — see FULL_SYNC_LOOKBACK_MS), paging through all
 * results, and returns the token to persist for the next call.
 *
 * `singleEvents` and `showDeleted` are passed on every call, sync or not:
 * Google ties a sync token to the parameter set that produced it, so
 * these must stay identical between the initial and every incremental
 * request — singleEvents expands recurring events into individual
 * instances (this app has no concept of a recurrence rule to store
 * otherwise), showDeleted is what makes a Google-side deletion show up at
 * all during an incremental sync.
 */
export async function listChangedGoogleCalendarEvents(
  syncToken: string | null,
): Promise<ListChangedEventsResult> {
  const connection = await getValidConnection();
  if (!connection) return { ok: false, reason: "no_connection" };

  const events: GoogleCalendarEventPayload[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        singleEvents: "true",
        showDeleted: "true",
        maxResults: "250",
      });
      if (syncToken) {
        params.set("syncToken", syncToken);
      } else {
        params.set(
          "timeMin",
          new Date(Date.now() - FULL_SYNC_LOOKBACK_MS).toISOString(),
        );
      }
      if (pageToken) params.set("pageToken", pageToken);

      const response = await callCalendarApi(
        "GET",
        `/calendars/${encodeURIComponent(connection.calendarId)}/events?${params.toString()}`,
        connection.accessToken,
      );

      if (response.status === 410) {
        // Google's documented signal for "this sync token is too old / no
        // longer valid" — the caller must clear it and do a fresh full sync.
        return { ok: false, reason: "sync_token_invalid" };
      }
      if (!response.ok) {
        return {
          ok: false,
          reason: "error",
          message: `Google Calendar respondió ${response.status}.`,
        };
      }

      const data = await response.json();
      if (Array.isArray(data.items)) events.push(...data.items);
      pageToken = data.nextPageToken;
      nextSyncToken = data.nextSyncToken;
    } while (pageToken);

    if (!nextSyncToken) {
      // Shouldn't happen (Google always includes it on the last page), but
      // without one we can't do an incremental sync next time.
      return {
        ok: false,
        reason: "error",
        message: "Google Calendar no devolvió un token de sincronización.",
      };
    }

    return { ok: true, events, nextSyncToken };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Error desconocido.",
    };
  }
}

export async function deleteGoogleCalendarEvent(
  googleEventId: string,
): Promise<boolean> {
  const connection = await getValidConnection();
  if (!connection) return false;

  try {
    const response = await callCalendarApi(
      "DELETE",
      `/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(googleEventId)}`,
      connection.accessToken,
    );
    // 404/410 means it's already gone on Google's side — that's the
    // outcome we wanted, not a failure.
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      console.error(
        "Failed to delete Google Calendar event, status:",
        response.status,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "Failed to delete Google Calendar event:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
