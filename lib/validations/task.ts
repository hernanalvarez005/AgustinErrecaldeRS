import { z } from "zod";

import { emptyToUndefined } from "@/lib/validations/shared";
import type { TaskPriority } from "@/types/database.types";

export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Ingresá un título para la tarea."),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  dueAt: z.preprocess(emptyToUndefined, z.string().optional()),
});
