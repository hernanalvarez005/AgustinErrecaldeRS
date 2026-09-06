"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  RECOMMENDATION_CHANNELS,
  RECOMMENDATION_STATUSES,
} from "@/lib/validations/recommendation";
import type {
  RecommendationChannel,
  RecommendationStatus,
} from "@/types/database.types";

/**
 * "Registrar envío" (V2 bloque G) — logs that a property was actually
 * sent to a client for one of their searches, distinct from the Fase 11
 * match score that's just computed on the fly. Used from both directions
 * of "Coincidencias" (property→searches in
 * app/(dashboard)/properties/[id]/page.tsx, search→properties in
 * app/(dashboard)/searches/[id]/page.tsx) — lives here, not under either
 * route, for the same reason lib/actions/engagement.ts does.
 */
export async function createRecommendation(
  propertyId: string,
  searchId: string,
  contactId: string,
  formData: FormData,
) {
  const membership = await requireMembership();
  const channelRaw = formData.get("channel");
  const channel = RECOMMENDATION_CHANNELS.includes(
    channelRaw as RecommendationChannel,
  )
    ? (channelRaw as RecommendationChannel)
    : "whatsapp";

  const supabase = await createClient();
  const { error } = await supabase.from("property_recommendations").insert({
    organization_id: membership.organization.id,
    property_id: propertyId,
    search_id: searchId,
    contact_id: contactId,
    channel,
  });
  if (error) {
    console.error("Failed to register recommendation:", error.message);
  }

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/searches/${searchId}`);
}

export async function updateRecommendationStatus(
  recommendationId: string,
  propertyId: string,
  formData: FormData,
) {
  await requireMembership();
  const status = formData.get("status");
  if (!RECOMMENDATION_STATUSES.includes(status as RecommendationStatus)) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("property_recommendations")
    .update({ status: status as RecommendationStatus })
    .eq("id", recommendationId);
  if (error) {
    console.error("Failed to update recommendation status:", error.message);
  }

  revalidatePath(`/properties/${propertyId}`);
}
