import { Plus } from "lucide-react";
import Link from "next/link";

import { DealsBoard } from "@/components/deals/deals-board";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/auth/session";
import { listDeals } from "@/lib/data/deals";

export default async function DealsPage({ searchParams }: PageProps<"/deals">) {
  const params = await searchParams;
  const view = params.view === "table" ? "table" : "kanban";
  const membership = await requireMembership();
  const deals = await listDeals(membership.organization.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operaciones</h1>
          <p className="text-muted-foreground text-sm">
            {deals.length} {deals.length === 1 ? "operación" : "operaciones"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            render={
              <Link
                href={`/deals?view=${view === "kanban" ? "table" : "kanban"}`}
              />
            }
            nativeButton={false}
            variant="outline"
          >
            {view === "kanban" ? "Ver tabla" : "Ver Kanban"}
          </Button>
          <Button render={<Link href="/deals/new" />} nativeButton={false}>
            <Plus />
            Operación
          </Button>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">Todavía no tenés operaciones.</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Registrá un comprador y un vendedor negociando una propiedad para
            empezar a hacer seguimiento del cierre.
          </p>
          <Button render={<Link href="/deals/new" />} nativeButton={false}>
            <Plus />
            Nueva operación
          </Button>
        </div>
      ) : (
        <DealsBoard deals={deals} view={view} />
      )}
    </div>
  );
}
