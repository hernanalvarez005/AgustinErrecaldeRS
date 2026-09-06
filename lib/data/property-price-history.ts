import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The full price change history for a property, oldest first (so the UI
 * reads top-to-bottom the way it happened) — see docs/DATABASE.md, V2
 * bloque C. Every row here was written by the `properties_log_price_change`
 * trigger, never by application code.
 */
export async function getPropertyPriceHistory(propertyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_price_history")
    .select("id, previous_price, new_price, currency, changed_at")
    .eq("property_id", propertyId)
    .order("changed_at", { ascending: true });

  if (error) {
    console.error("Failed to load property price history:", error.message);
    return [];
  }
  return data;
}
