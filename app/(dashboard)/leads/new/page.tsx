import { createLead } from "@/app/(dashboard)/leads/actions";
import { LeadForm } from "@/components/leads/lead-form";
import { requireMembership } from "@/lib/auth/session";
import { listPropertyOptions } from "@/lib/data/properties";

export default async function NewLeadPage({
  searchParams,
}: PageProps<"/leads/new">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  const membership = await requireMembership();
  const properties = await listPropertyOptions(membership.organization.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo lead</h1>
        <p className="text-muted-foreground text-sm">
          Cargá la consulta tal como llegó — después la convertís en contacto.
        </p>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      <LeadForm properties={properties} action={createLead} />
    </div>
  );
}
