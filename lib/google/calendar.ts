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
async function getValidConnection(): Promise<{
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
