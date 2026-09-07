"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import { syncGoogleCalendarEvents } from "@/lib/google/calendar-sync";
import { createClient } from "@/lib/supabase/server";

/**
 * "Sincronizar ahora" (spec V2.2 punto 30) — manually triggers the
 * Google → CRM incremental sync (lib/google/calendar-sync.ts). Returns a
 * result the settings page turns into a toast rather than redirecting,
 * so the advisor stays on the page and sees import/update counts.
 */
export async function syncGoogleCalendarNow(): Promise<
  { error: string } | { success: true; message: string }
> {
  const result = await syncGoogleCalendarEvents();
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/today");

  if (!result.ok) return { error: result.error };

  const parts: string[] = [];
  if (result.imported) parts.push(`${result.imported} nuevo(s)`);
  if (result.updated) parts.push(`${result.updated} actualizado(s)`);
  if (result.cancelled) parts.push(`${result.cancelled} cancelado(s)`);
  if (result.removed) parts.push(`${result.removed} eliminado(s)`);
  return {
    success: true,
    message: parts.length
      ? `Sincronizado: ${parts.join(", ")}.`
      : "Sincronizado: sin cambios nuevos.",
  };
}

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
