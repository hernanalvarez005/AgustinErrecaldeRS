import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

/**
 * Compact KPI card with an optional trend vs. the previous period (V2.1
 * Bloque UI-7, spec point 67 — "Visitas 24 +12% vs período anterior").
 * `delta` is a whole-number percentage; `null` means "no comparable
 * baseline" (previous period was 0 and current isn't — the % would be
 * infinite/meaningless) and renders no trend at all rather than a
 * misleading number.
 */
export function KpiCard({
  label,
  value,
  delta,
  children,
}: {
  label: string;
  value: React.ReactNode;
  /** Whole-number percentage change vs. the previous period, or `null`/`undefined` if there's no comparison to show (period "all", or no baseline). */
  delta?: number | null;
  /** Extra content below the value (e.g. commission breakdown) — takes over from `delta` when present. */
  children?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        {delta !== undefined && delta !== null ? (
          <span
            title="vs. período anterior"
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              delta > 0
                ? "text-success"
                : delta < 0
                  ? "text-danger"
                  : "text-muted-foreground",
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="size-3" />
            ) : delta < 0 ? (
              <TrendingDown className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
        ) : null}
      </CardContent>
      {children}
    </Card>
  );
}
