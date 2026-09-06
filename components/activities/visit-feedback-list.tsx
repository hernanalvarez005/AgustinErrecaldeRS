import { formatEventDay } from "@/lib/format";
import {
  VISIT_INTEREST_LEVEL_LABELS,
  VISIT_PRICE_PERCEPTION_LABELS,
  VISIT_WANTS_TO_PROCEED_LABELS,
} from "@/lib/validations/visit-feedback";
import type {
  VisitInterestLevel,
  VisitPricePerception,
  VisitWantsToProceed,
} from "@/types/database.types";

export type VisitFeedbackListItem = {
  id: string;
  starts_at: string;
  label: string;
  interest_level: VisitInterestLevel | null;
  price_perception: VisitPricePerception | null;
  wants_to_proceed: VisitWantsToProceed | null;
  positive_feedback: string | null;
  negative_feedback: string | null;
  notes: string | null;
};

/**
 * Shared render for "cliente → Visitas" and "propiedad → Visitas" (V2
 * bloque D) — same shape either way, `label` is just whichever "other
 * side" (contact name / property title) belongs on that page.
 */
export function VisitFeedbackList({
  items,
  emptyMessage,
}: {
  items: VisitFeedbackListItem[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="space-y-1 rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{item.label}</span>
            <span className="text-muted-foreground text-xs">
              {formatEventDay(item.starts_at)}
            </span>
          </div>
          <p className="text-muted-foreground">
            {item.interest_level
              ? VISIT_INTEREST_LEVEL_LABELS[item.interest_level]
              : "Sin nivel de interés"}
            {item.price_perception
              ? ` · Precio: ${VISIT_PRICE_PERCEPTION_LABELS[item.price_perception]}`
              : ""}
            {item.wants_to_proceed
              ? ` · Quiere avanzar: ${VISIT_WANTS_TO_PROCEED_LABELS[item.wants_to_proceed]}`
              : ""}
          </p>
          {item.positive_feedback ? (
            <p className="text-muted-foreground">👍 {item.positive_feedback}</p>
          ) : null}
          {item.negative_feedback ? (
            <p className="text-muted-foreground">👎 {item.negative_feedback}</p>
          ) : null}
          {item.notes ? (
            <p className="text-muted-foreground">{item.notes}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
