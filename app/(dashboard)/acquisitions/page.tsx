import { Plus } from "lucide-react";
import Link from "next/link";

import { AcquisitionsBoard } from "@/components/acquisitions/acquisitions-board";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/auth/session";
import { listAcquisitions } from "@/lib/data/acquisitions";

export default async function AcquisitionsPage({
  searchParams,
}: PageProps<"/acquisitions">) {
  const params = await searchParams;
  const view = params.view === "table" ? "table" : "kanban";
  const membership = await requireMembership();
  const acquisitions = await listAcquisitions(membership.organization.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Captaciones</h1>
          <p className="text-muted-foreground text-sm">
            {acquisitions.length}{" "}
            {acquisitions.length === 1 ? "captación" : "captaciones"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            render={
              <Link
                href={`/acquisitions?view=${view === "kanban" ? "table" : "kanban"}`}
              />
            }
            nativeButton={false}
            variant="outline"
          >
            {view === "kanban" ? "Ver tabla" : "Ver Kanban"}
          </Button>
          <Button
            render={<Link href="/acquisitions/quick" />}
            nativeButton={false}
            variant="outline"
          >
            <Plus />
            Captación rápida
          </Button>
          <Button
            render={<Link href="/acquisitions/new" />}
            nativeButton={false}
          >
            <Plus />
            Captación
          </Button>
        </div>
      </div>

      {acquisitions.length === 0 ? (
        <EmptyState
          title="Todavía no tenés captaciones."
          description="Registrá un propietario interesado en vender para comenzar."
          actionLabel="Nueva captación"
          actionHref="/acquisitions/new"
        />
      ) : (
        <AcquisitionsBoard acquisitions={acquisitions} view={view} />
      )}
    </div>
  );
}
