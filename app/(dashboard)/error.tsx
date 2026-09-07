"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary for every `(dashboard)` page (spec point 62
 * — compact, actionable errors, not a stack trace). This is a safety net
 * for a genuinely unexpected thrown error (a bug, a network failure) — it
 * does NOT catch the common case of a failed Supabase query, since every
 * `lib/data/*` function already logs and returns `[]`/`null` instead of
 * throwing (see docs/ARCHITECTURE.md's data-layer conventions), so most
 * "no pudimos cargar X" states render as an empty list, not this boundary.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <h2 className="text-lg font-medium">No pudimos cargar esta pantalla.</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Ocurrió un error inesperado. Podés intentar de nuevo.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
