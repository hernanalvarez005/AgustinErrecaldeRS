import type { OperationType, PropertyType } from "@/types/database.types";

/**
 * Deterministic property↔search matching — no AI/ML involved (see
 * docs/ROADMAP.md, Fase 11). Two pieces, used together by lib/data/matching.ts:
 *
 * - `isPropertyEligibleForSearch`: hard filters. A property that fails these
 *   isn't a candidate at all — it gets excluded from the list entirely, not
 *   scored low. Wrong operation type (venta vs alquiler) or wrong property
 *   type is a disqualifier, not "a weaker match".
 * - `computeMatchScore`: for properties that pass the hard filters, a 0-100
 *   score built from weighted criteria (presupuesto, ubicación, ambientes,
 *   superficie, cochera). Each criterion only counts if BOTH sides have the
 *   data to evaluate it — the score is normalized against the total weight
 *   of criteria that actually applied, so a search with few constraints
 *   isn't punished for "missing" data it never asked about, and a property
 *   missing a field doesn't get unfairly zeroed out either (see
 *   docs/DATABASE.md, Fase 11, for why this is the most honest scoring
 *   given what the schema actually tracks).
 *
 * Known limitation, documented on purpose: `property_searches` tracks
 * `requires_balcony`/`requires_patio`/`requires_elevator`, but `properties`
 * has no matching columns to check them against — there is nothing to
 * compare them to, so those three requirements are never scored. Only
 * `requires_garage` is scored, against `garage_spaces`.
 */

export type SearchForMatching = {
  operation_type: OperationType;
  property_types: PropertyType[];
  min_price: number | null;
  max_price: number | null;
  currency: "ARS" | "USD" | null;
  cities: string[];
  neighborhoods: string[];
  min_bedrooms: number | null;
  max_bedrooms: number | null;
  min_total_area: number | null;
  min_covered_area: number | null;
  requires_garage: boolean;
};

export type PropertyForMatching = {
  operation_type: OperationType;
  property_type: PropertyType;
  price: number | null;
  currency: "ARS" | "USD" | null;
  city: string | null;
  neighborhood: string | null;
  bedrooms: number | null;
  total_area: number | null;
  covered_area: number | null;
  garage_spaces: number | null;
};

/** Hard filters: a property either can be suggested for this search or it can't. */
export function isPropertyEligibleForSearch(
  search: SearchForMatching,
  property: PropertyForMatching,
): boolean {
  if (search.operation_type !== property.operation_type) return false;
  if (
    search.property_types.length > 0 &&
    !search.property_types.includes(property.property_type)
  ) {
    return false;
  }
  return true;
}

export type MatchCriterion = {
  key: "price" | "location" | "bedrooms" | "area" | "garage";
  label: string;
  applicable: boolean;
  weight: number;
  earned: number;
  detail: string;
};

export type MatchResult = {
  score: number;
  criteria: MatchCriterion[];
};

function ratioScore(ratio: number): number {
  if (ratio >= 1) return 1;
  if (ratio >= 0.9) return 0.5;
  return 0;
}

function scorePrice(
  search: SearchForMatching,
  property: PropertyForMatching,
): MatchCriterion {
  const weight = 35;
  const label = "Presupuesto";
  const hasBudget = search.min_price !== null || search.max_price !== null;
  const sameCurrency =
    search.currency === null || search.currency === property.currency;
  if (property.price === null || !hasBudget || !sameCurrency) {
    return {
      key: "price",
      label,
      applicable: false,
      weight,
      earned: 0,
      detail: "Sin datos suficientes.",
    };
  }

  const min = search.min_price ?? -Infinity;
  const max = search.max_price ?? Infinity;
  const price = property.price;

  if (price >= min && price <= max) {
    return {
      key: "price",
      label,
      applicable: true,
      weight,
      earned: weight,
      detail: "Dentro del presupuesto.",
    };
  }
  // 10% tolerance either side — an advisor would still want to see a
  // near-miss, not just an exact range match.
  const nearOverMax = max !== Infinity && price <= max * 1.1;
  const nearUnderMin = min !== -Infinity && price >= min * 0.9;
  if (nearOverMax || nearUnderMin) {
    return {
      key: "price",
      label,
      applicable: true,
      weight,
      earned: weight / 2,
      detail: "Cerca del presupuesto (dentro de un 10%).",
    };
  }
  return {
    key: "price",
    label,
    applicable: true,
    weight,
    earned: 0,
    detail: "Fuera del presupuesto.",
  };
}

function scoreLocation(
  search: SearchForMatching,
  property: PropertyForMatching,
): MatchCriterion {
  const weight = 25;
  const label = "Ubicación";
  const hasPreference =
    search.cities.length > 0 || search.neighborhoods.length > 0;
  const hasLocation = property.city !== null || property.neighborhood !== null;
  if (!hasPreference || !hasLocation) {
    return {
      key: "location",
      label,
      applicable: false,
      weight,
      earned: 0,
      detail: "Sin datos suficientes.",
    };
  }

  const neighborhoodMatch =
    property.neighborhood !== null &&
    search.neighborhoods.includes(property.neighborhood);
  const cityMatch =
    property.city !== null && search.cities.includes(property.city);

  if (search.neighborhoods.length > 0 && neighborhoodMatch) {
    return {
      key: "location",
      label,
      applicable: true,
      weight,
      earned: weight,
      detail: "Coincide el barrio.",
    };
  }
  if (cityMatch) {
    // Full credit if the search only cared about the city; partial if it
    // named specific neighborhoods and this one isn't among them.
    const earned = search.neighborhoods.length > 0 ? weight * 0.6 : weight;
    return {
      key: "location",
      label,
      applicable: true,
      weight,
      earned,
      detail: "Coincide la ciudad.",
    };
  }
  return {
    key: "location",
    label,
    applicable: true,
    weight,
    earned: 0,
    detail: "No coincide la zona buscada.",
  };
}

function scoreBedrooms(
  search: SearchForMatching,
  property: PropertyForMatching,
): MatchCriterion {
  const weight = 20;
  const label = "Ambientes";
  const hasPreference =
    search.min_bedrooms !== null || search.max_bedrooms !== null;
  if (property.bedrooms === null || !hasPreference) {
    return {
      key: "bedrooms",
      label,
      applicable: false,
      weight,
      earned: 0,
      detail: "Sin datos suficientes.",
    };
  }

  const min = search.min_bedrooms ?? -Infinity;
  const max = search.max_bedrooms ?? Infinity;
  const bedrooms = property.bedrooms;

  if (bedrooms >= min && bedrooms <= max) {
    return {
      key: "bedrooms",
      label,
      applicable: true,
      weight,
      earned: weight,
      detail: "Dentro del rango buscado.",
    };
  }
  if (bedrooms === min - 1 || bedrooms === max + 1) {
    return {
      key: "bedrooms",
      label,
      applicable: true,
      weight,
      earned: weight / 2,
      detail: "Un ambiente de diferencia.",
    };
  }
  return {
    key: "bedrooms",
    label,
    applicable: true,
    weight,
    earned: 0,
    detail: "Fuera del rango buscado.",
  };
}

function scoreArea(
  search: SearchForMatching,
  property: PropertyForMatching,
): MatchCriterion {
  const weight = 10;
  const label = "Superficie";
  const checks: number[] = [];
  if (search.min_total_area !== null && property.total_area !== null) {
    checks.push(ratioScore(property.total_area / search.min_total_area));
  }
  if (search.min_covered_area !== null && property.covered_area !== null) {
    checks.push(ratioScore(property.covered_area / search.min_covered_area));
  }
  if (checks.length === 0) {
    return {
      key: "area",
      label,
      applicable: false,
      weight,
      earned: 0,
      detail: "Sin datos suficientes.",
    };
  }
  const avg = checks.reduce((a, b) => a + b, 0) / checks.length;
  const detail =
    avg === 1
      ? "Cumple la superficie mínima."
      : avg > 0
        ? "Cerca de la superficie mínima."
        : "Por debajo de la superficie mínima.";
  return {
    key: "area",
    label,
    applicable: true,
    weight,
    earned: avg * weight,
    detail,
  };
}

function scoreGarage(
  search: SearchForMatching,
  property: PropertyForMatching,
): MatchCriterion {
  const weight = 10;
  const label = "Cochera";
  if (!search.requires_garage) {
    return {
      key: "garage",
      label,
      applicable: false,
      weight,
      earned: 0,
      detail: "No requerida.",
    };
  }
  const hasGarage = (property.garage_spaces ?? 0) > 0;
  return {
    key: "garage",
    label,
    applicable: true,
    weight,
    earned: hasGarage ? weight : 0,
    detail: hasGarage ? "Tiene cochera." : "No tiene cochera.",
  };
}

export function computeMatchScore(
  search: SearchForMatching,
  property: PropertyForMatching,
): MatchResult {
  const criteria = [
    scorePrice(search, property),
    scoreLocation(search, property),
    scoreBedrooms(search, property),
    scoreArea(search, property),
    scoreGarage(search, property),
  ];
  const applicable = criteria.filter((c) => c.applicable);
  if (applicable.length === 0) {
    // Nothing left to disqualify it beyond the hard filters that already
    // passed in isPropertyEligibleForSearch — treat it as a full match.
    return { score: 100, criteria };
  }
  const totalWeight = applicable.reduce((sum, c) => sum + c.weight, 0);
  const totalEarned = applicable.reduce((sum, c) => sum + c.earned, 0);
  return { score: Math.round((totalEarned / totalWeight) * 100), criteria };
}

/** Below this, a match isn't worth showing the advisor. */
export const MIN_MATCH_SCORE = 40;

/** One-line, ordered summary of the criteria that actually applied — skips the ones with no data on either side. */
export function summarizeCriteria(criteria: MatchCriterion[]): string {
  const applicable = criteria.filter((c) => c.applicable);
  if (applicable.length === 0) return "Sin criterios para comparar.";
  return applicable
    .map((c) => {
      const symbol = c.earned === c.weight ? "✓" : c.earned === 0 ? "✗" : "~";
      return `${c.label} ${symbol}`;
    })
    .join(" · ");
}
