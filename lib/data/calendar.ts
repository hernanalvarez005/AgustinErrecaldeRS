import "server-only";

import {
  resolveEngagementLinks,
  type EngagementLink,
} from "@/lib/data/engagement-links";
import { createClient } from "@/lib/supabase/server";
import type { ActivityStatus, ActivityType } from "@/types/database.types";

export type CalendarEvent = {
  id: string;
  type: ActivityType;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  status: ActivityStatus;
  location: string | null;
  meeting_url: string | null;
  link: EngagementLink | null;
};

/** Every activity (any status) with starts_at in [startUtc, endUtc) — the calendar shows past and future events alike. */
export async function listEventsInRange(
  organizationId: string,
  startUtc: string,
  endUtc: string,
): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, type, description, starts_at, ends_at, status, location, meeting_url, contact_id, property_id, acquisition_id, search_id, lead_id, deal_id",
    )
    .eq("organization_id", organizationId)
    .gte("starts_at", startUtc)
    .lt("starts_at", endUtc)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("Failed to list calendar events:", error.message);
    return [];
  }
  return resolveEngagementLinks(data);
}

export async function getEvent(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to load event:", error.message);
    return null;
  }
  return data;
}
