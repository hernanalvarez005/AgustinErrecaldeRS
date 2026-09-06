import "server-only";

import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function getGoogleCalendarConnection() {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("google_email, calendar_id, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load Google Calendar connection:", error.message);
    return null;
  }
  return data;
}
