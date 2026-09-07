import type { FunnelStage } from "@/lib/data/dashboard";

/**
 * Plain CSS horizontal bars — no charting library. This project has no
 * chart dependency installed and the data here is a handful of stages
 * with small counts, so a real charting lib would be overkill (same
 * "avoid unnecessary dependencies" call as the Kanban boards, which are
 * also hand-built).
 *
 * V2.1 Bloque UI-7: fill color moves from `bg-foreground` to `bg-primary`
 * (spec point 74 — "serie principal → primary" in charts), and each stage
 * now shows its conversion % relative to the funnel's first stage (spec
 * point 72 — "Mostrar: cantidad; porcentaje de conversión"), not just the
 * raw count.
 */
export function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const firstStageCount = stages[0]?.count ?? 0;

  if (stages.every((s) => s.count === 0)) {
    return (
      <p className="text-muted-foreground text-sm">
        Sin datos en este período.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {stages.map((stage) => {
        const conversion =
          firstStageCount > 0
            ? Math.round((stage.count / firstStageCount) * 100)
            : null;
        return (
          <li
            key={stage.status}
            className="flex items-center gap-2 text-sm"
            title={`${stage.label}: ${stage.count}${conversion !== null ? ` (${conversion}% de "${stages[0].label}")` : ""}`}
          >
            <span className="text-muted-foreground w-32 shrink-0 truncate">
              {stage.label}
            </span>
            <div className="bg-muted h-4 flex-1 overflow-hidden rounded">
              <div
                className="bg-primary h-full rounded"
                style={{ width: `${(stage.count / max) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground w-8 shrink-0 text-right tabular-nums">
              {conversion !== null ? `${conversion}%` : ""}
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums">
              {stage.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
