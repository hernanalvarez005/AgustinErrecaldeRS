import "server-only";

import {
  computeMatchScore,
  isPropertyEligibleForSearch,
  MIN_MATCH_SCORE,
  summarizeCriteria,
  type PropertyForMatching,
  type SearchForMatching,
} from "@/lib/matching/score";
import { createClient } from "@/lib/supabase/server";
import type { PropertyStatus, SearchStatus } from "@/types/database.types";

/** Every row read here is capped at this — a solo advisor's data volume never approaches it (same reasoning as lib/data/dashboard.ts), and grouping/scoring happens in JS on the capped set. */
const CANDIDATE_ROW_LIMIT = 500;

/** How many ranked matches to show — this is a shortlist for a human to read, not a paginated list. */
const MAX_MATCHES = 20;

/** Property statuses worth suggesting — still actively being marketed. Excludes draft/valuation (not ready to show) and reserved/sold/rented/paused/lost/archived (no longer available). */
const MATCHABLE_PROPERTY_STATUSES: PropertyStatus[] = ["capturing", "active"];

/** Search statuses still open to receiving suggestions. Excludes reserved/closed/paused/lost. */
const MATCHABLE_SEARCH_STATUSES: SearchStatus[] = [
  "new",
  "qualified",
  "searching",
  "options_sent",
  "visiting",
  "negotiating",
];

export type MatchedProperty = {
  id: string;
  title: string;
  property_type: string;
  operation_type: string;
  price: number | null;
  currency: "ARS" | "USD" | null;
  city: string | null;
  neighborhood: string | null;
  bedrooms: number | null;
  status: PropertyStatus;
};

export type PropertyMatch = {
  property: MatchedProperty;
  score: number;
  summary: string;
};

/** Ranked active properties that fit a given search's criteria, best first. */
export async function getPropertyMatchesForSearch(
  organizationId: string,
  search: SearchForMatching,
): Promise<PropertyMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, title, property_type, operation_type, price, currency, city, neighborhood, bedrooms, total_area, covered_area, garage_spaces, status",
    )
    .eq("organization_id", organizationId)
    .eq("operation_type", search.operation_type)
    .in("status", MATCHABLE_PROPERTY_STATUSES)
    .limit(CANDIDATE_ROW_LIMIT);

  if (error) {
    console.error(
      "Failed to load candidate properties for matching:",
      error.message,
    );
    return [];
  }

  return data
    .filter((property) => isPropertyEligibleForSearch(search, property))
    .map((property) => {
      const { score, criteria } = computeMatchScore(search, property);
      return { property, score, summary: summarizeCriteria(criteria) };
    })
    .filter((match) => match.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES);
}

export type MatchedSearch = {
  id: string;
  contact_id: string;
  contact_first_name: string;
  contact_last_name: string;
  operation_type: string;
  min_price: number | null;
  max_price: number | null;
  currency: "ARS" | "USD" | null;
  cities: string[];
  status: SearchStatus;
};

export type SearchMatch = {
  search: MatchedSearch;
  score: number;
  summary: string;
};

/** Ranked open searches that fit a given property, best first. */
export async function getSearchMatchesForProperty(
  organizationId: string,
  property: PropertyForMatching,
): Promise<SearchMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("search_overview")
    .select(
      "id, contact_id, contact_first_name, contact_last_name, operation_type, property_types, min_price, max_price, currency, cities, neighborhoods, min_bedrooms, max_bedrooms, min_total_area, min_covered_area, requires_garage, status",
    )
    .eq("organization_id", organizationId)
    .eq("operation_type", property.operation_type)
    .in("status", MATCHABLE_SEARCH_STATUSES)
    .limit(CANDIDATE_ROW_LIMIT);

  if (error) {
    console.error(
      "Failed to load candidate searches for matching:",
      error.message,
    );
    return [];
  }

  return data
    .filter((search) => isPropertyEligibleForSearch(search, property))
    .map((search) => {
      const { score, criteria } = computeMatchScore(search, property);
      return { search, score, summary: summarizeCriteria(criteria) };
    })
    .filter((match) => match.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES);
}
