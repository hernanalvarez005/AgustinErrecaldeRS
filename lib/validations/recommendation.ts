import type {
  RecommendationChannel,
  RecommendationStatus,
} from "@/types/database.types";

export const RECOMMENDATION_CHANNELS: RecommendationChannel[] = [
  "whatsapp",
  "email",
  "in_person",
  "other",
];

export const RECOMMENDATION_CHANNEL_LABELS: Record<
  RecommendationChannel,
  string
> = {
  whatsapp: "WhatsApp",
  email: "Email",
  in_person: "En persona",
  other: "Otro",
};

export const RECOMMENDATION_STATUSES: RecommendationStatus[] = [
  "sent",
  "interested",
  "not_interested",
  "visit_scheduled",
];

export const RECOMMENDATION_STATUS_LABELS: Record<
  RecommendationStatus,
  string
> = {
  sent: "Enviada",
  interested: "Interesado",
  not_interested: "No interesado",
  visit_scheduled: "Visita agendada",
};
