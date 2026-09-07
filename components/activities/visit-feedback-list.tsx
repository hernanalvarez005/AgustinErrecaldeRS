import { ThumbsDown, ThumbsUp } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { formatEventDay } from "@/lib/format";
import {
  visitInterestLevelTone,
  visitWantsToProceedTone,
} from "@/lib/status-tone";
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
 * side" (contact name / property title) belongs on that page. V2.1 bloque
 * UI-6: interest level and "wants to proceed" get a semantic StatusBadge
 * instead of plain text, and 👍/👎 become Lucide icons (spec point 24 —
 * no emoji as product iconography, Lucide is the one icon set).
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
        <li key={item.id} className="space-y-1.5 rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{item.label}</span>
            <span className="text-muted-foreground text-xs">
              {formatEventDay(item.starts_at)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {item.interest_level ? (
              <StatusBadge tone={visitInterestLevelTone(item.interest_level)}>
                {VISIT_INTEREST_LEVEL_LABELS[item.interest_level]}
              </StatusBadge>
            ) : (
              <span className="text-muted-foreground">
                Sin nivel de interés
              </span>
            )}
            {item.wants_to_proceed ? (
              <StatusBadge
                tone={visitWantsToProceedTone(item.wants_to_proceed)}
              >
                Avanza: {VISIT_WANTS_TO_PROCEED_LABELS[item.wants_to_proceed]}
              </StatusBadge>
            ) : null}
            {item.price_perception ? (
              <span className="text-muted-foreground">
                Precio: {VISIT_PRICE_PERCEPTION_LABELS[item.price_perception]}
              </span>
            ) : null}
          </div>
          {item.positive_feedback ? (
            <p className="text-muted-foreground flex items-start gap-1.5">
              <ThumbsUp className="mt-0.5 size-3.5 shrink-0" />
              {item.positive_feedback}
            </p>
          ) : null}
          {item.negative_feedback ? (
            <p className="text-muted-foreground flex items-start gap-1.5">
              <ThumbsDown className="mt-0.5 size-3.5 shrink-0" />
              {item.negative_feedback}
            </p>
          ) : null}
          {item.notes ? (
            <p className="text-muted-foreground">{item.notes}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
