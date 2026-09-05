import {
  CheckCircle2,
  MessageSquareText,
  Phone,
  StickyNote,
} from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { ACTIVITY_TYPE_LABELS } from "@/lib/validations/activity";
import type { ActivityType } from "@/types/database.types";

type TimelineEntry =
  | { kind: "note"; id: string; at: string; body: string }
  | {
      kind: "activity";
      id: string;
      at: string;
      type: ActivityType;
      description: string | null;
    }
  | { kind: "task_completed"; id: string; at: string; title: string };

export function buildTimeline({
  notes,
  activities,
  tasks,
}: {
  notes: Array<{ id: string; body: string; created_at: string }>;
  activities: Array<{
    id: string;
    type: ActivityType;
    description: string | null;
    starts_at: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    completed_at: string | null;
  }>;
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...notes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      at: n.created_at,
      body: n.body,
    })),
    ...activities.map((a) => ({
      kind: "activity" as const,
      id: a.id,
      at: a.starts_at,
      type: a.type,
      description: a.description,
    })),
    ...tasks
      .filter((t) => t.status === "completed" && t.completed_at)
      .map((t) => ({
        kind: "task_completed" as const,
        id: t.id,
        at: t.completed_at as string,
        title: t.title,
      })),
  ];

  return entries.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

function EntryIcon({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "note")
    return <StickyNote className="text-muted-foreground size-4" />;
  if (entry.kind === "task_completed")
    return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (entry.type === "call")
    return <Phone className="text-muted-foreground size-4" />;
  return <MessageSquareText className="text-muted-foreground size-4" />;
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavía no hay actividad registrada.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`} className="flex gap-3 text-sm">
          <div className="mt-0.5 shrink-0">
            <EntryIcon entry={entry} />
          </div>
          <div className="space-y-0.5">
            <p>
              {entry.kind === "note" && entry.body}
              {entry.kind === "task_completed" && (
                <>
                  Tarea completada:{" "}
                  <span className="font-medium">{entry.title}</span>
                </>
              )}
              {entry.kind === "activity" && (
                <>
                  <span className="font-medium">
                    {ACTIVITY_TYPE_LABELS[entry.type]}
                  </span>
                  {entry.description ? ` — ${entry.description}` : ""}
                </>
              )}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatDateTime(entry.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
