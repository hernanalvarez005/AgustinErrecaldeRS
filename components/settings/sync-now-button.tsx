"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { syncGoogleCalendarNow } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";

/** "Sincronizar ahora" (spec V2.2 punto 30) — triggers the Google → CRM incremental sync and reports the result as a toast. */
export function SyncNowButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await syncGoogleCalendarNow();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "Sincronizando…" : "Sincronizar ahora"}
    </Button>
  );
}
