import type { FunnelStage } from "@/lib/data/dashboard";

/**
 * Plain CSS horizontal bars — no charting library. This project has no
 * chart dependency installed and the data here is a handful of stages
 * with small counts, so a real charting lib would be overkill (same
 * "avoid unnecessary dependencies" call as the Kanban boards, which are
 * also hand-built).
 */
export function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  if (stages.every((s) => s.count === 0)) {
    return (
      <p className="text-muted-foreground text-sm">
        Sin datos en este período.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {stages.map((stage) => (
        <li key={stage.status} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground w-32 shrink-0 truncate">
            {stage.label}
          </span>
          <div className="bg-muted h-4 flex-1 overflow-hidden rounded">
            <div
              className="bg-foreground h-full rounded"
              style={{ width: `${(stage.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums">
            {stage.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
