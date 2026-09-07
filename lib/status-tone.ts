import type {
  AcquisitionStatus,
  ActivityStatus,
  DealStatus,
  LeadStatus,
  OfferStatus,
  PropertyStatus,
  RecommendationStatus,
  SearchStatus,
  TaskPriority,
  VisitInterestLevel,
  VisitWantsToProceed,
} from "@/types/database.types";

/**
 * Semantic status tones, V2.1 design system (see docs/DESIGN_SYSTEM.md).
 *
 * One function per domain maps that domain's status enum to a *meaning*,
 * not a fixed color per value — the same five tones are reused everywhere:
 *
 *   neutral  sin iniciar / informativo
 *   primary  en curso / requiere acción del usuario
 *   warning  requiere atención / por vencer
 *   success  resultado favorable / cerrado con éxito
 *   danger   resultado negativo / cancelado / vencido
 *
 * Consumed by components/shared/status-badge.tsx. Adding a new enum value
 * to a status column must add it here too — TypeScript's exhaustiveness
 * check (the `never` branch) fails the build otherwise, which is
 * intentional: a status with no assigned tone is a bug, not a fallback.
 */
export type StatusTone =
  "neutral" | "primary" | "warning" | "success" | "danger";

function assertUnreachable(value: never): never {
  throw new Error(`Unmapped status tone: ${String(value)}`);
}

export function acquisitionStatusTone(status: AcquisitionStatus): StatusTone {
  switch (status) {
    case "new_lead":
      return "neutral";
    case "contacted":
    case "meeting_scheduled":
    case "meeting_completed":
    case "valuation":
    case "proposal_sent":
      return "primary";
    case "follow_up":
      return "warning";
    case "won":
      return "success";
    case "lost":
      return "danger";
    default:
      return assertUnreachable(status);
  }
}

export function dealStatusTone(status: DealStatus): StatusTone {
  switch (status) {
    case "negotiation":
    case "offer":
    case "reservation":
    case "documentation":
    case "contract":
    case "closing":
      return "primary";
    case "closed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return assertUnreachable(status);
  }
}

export function offerStatusTone(status: OfferStatus): StatusTone {
  switch (status) {
    case "pending":
      return "warning";
    case "counter_offered":
      return "primary";
    case "accepted":
      return "success";
    case "rejected":
    case "expired":
      return "danger";
    case "withdrawn":
      return "neutral";
    default:
      return assertUnreachable(status);
  }
}

export function searchStatusTone(status: SearchStatus): StatusTone {
  switch (status) {
    case "new":
      return "neutral";
    case "qualified":
    case "searching":
    case "options_sent":
    case "visiting":
    case "negotiating":
    case "reserved":
      return "primary";
    case "closed":
      return "success";
    case "paused":
      return "neutral";
    case "lost":
      return "danger";
    default:
      return assertUnreachable(status);
  }
}

export function leadStatusTone(status: LeadStatus): StatusTone {
  switch (status) {
    case "new":
      return "neutral";
    case "contacted":
    case "qualified":
      return "primary";
    case "converted":
      return "success";
    case "unresponsive":
      return "warning";
    case "not_interested":
    case "lost":
      return "danger";
    default:
      return assertUnreachable(status);
  }
}

export function propertyStatusTone(status: PropertyStatus): StatusTone {
  switch (status) {
    case "draft":
    case "paused":
    case "archived":
      return "neutral";
    case "valuation":
    case "capturing":
    case "active":
    case "reserved":
      return "primary";
    case "sold":
    case "rented":
      return "success";
    case "lost":
      return "danger";
    default:
      return assertUnreachable(status);
  }
}

export function recommendationStatusTone(
  status: RecommendationStatus,
): StatusTone {
  switch (status) {
    case "sent":
      return "neutral";
    case "interested":
    case "visit_scheduled":
      return "success";
    case "not_interested":
      return "danger";
    default:
      return assertUnreachable(status);
  }
}

export function activityStatusTone(status: ActivityStatus): StatusTone {
  switch (status) {
    case "scheduled":
      return "primary";
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return assertUnreachable(status);
  }
}

export function taskPriorityTone(priority: TaskPriority): StatusTone {
  switch (priority) {
    case "low":
      return "neutral";
    case "medium":
      return "primary";
    case "high":
      return "warning";
    case "urgent":
      return "danger";
    default:
      return assertUnreachable(priority);
  }
}

export function visitInterestLevelTone(level: VisitInterestLevel): StatusTone {
  switch (level) {
    case "very_interested":
    case "interested":
      return "success";
    case "unsure":
      return "warning";
    case "discarded":
      return "danger";
    default:
      return assertUnreachable(level);
  }
}

export function visitWantsToProceedTone(
  value: VisitWantsToProceed,
): StatusTone {
  switch (value) {
    case "yes":
      return "success";
    case "thinking":
      return "warning";
    case "no":
      return "danger";
    default:
      return assertUnreachable(value);
  }
}
