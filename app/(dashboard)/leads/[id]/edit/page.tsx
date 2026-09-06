import { notFound } from "next/navigation";

import { updateLead } from "@/app/(dashboard)/leads/actions";
import { LeadForm } from "@/components/leads/lead-form";
import { requireMembership } from "@/lib/auth/session";
import { getLead } from "@/lib/data/leads";
import { listPropertyOptions } from "@/lib/data/properties";

export default async function EditLeadPage({
  params,
  searchParams,
}: PageProps<"/leads/[id]/edit">) {
  const { id } = await params;
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;

  const membership = await requireMembership();
  const [lead, properties] = await Promise.all([
    getLead(id),
    listPropertyOptions(membership.organization.id),
  ]);
  if (!lead) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar lead</h1>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      <LeadForm
        lead={lead}
        properties={properties}
        action={updateLead.bind(null, lead.id)}
      />
    </div>
  );
}
