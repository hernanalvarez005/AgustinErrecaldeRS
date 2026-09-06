"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function disconnectGoogleCalendar() {
  const user = await getAuthUser();
  if (!user) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", user.id);
  if (error) {
    console.error("Failed to disconnect Google Calendar:", error.message);
  }

  revalidatePath("/settings");
}
