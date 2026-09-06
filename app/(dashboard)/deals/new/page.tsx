import { createDeal } from "@/app/(dashboard)/deals/actions";
import { DealForm } from "@/components/deals/deal-form";
import { requireMembership } from "@/lib/auth/session";
import { listContactOptions, listPropertyOptions } from "@/lib/data/properties";

export default async function NewDealPage({
  searchParams,
}: PageProps<"/deals/new">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  const membership = await requireMembership();
  const [properties, contacts] = await Promise.all([
    listPropertyOptions(membership.organization.id),
    listContactOptions(membership.organization.id),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nueva operación
        </h1>
        <p className="text-muted-foreground text-sm">
          Con la propiedad, el comprador y el vendedor alcanza para arrancar.
        </p>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      {properties.length === 0 || contacts.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Necesitás al menos una propiedad y dos contactos (comprador y
          vendedor) cargados para poder registrar una operación.
        </p>
      ) : (
        <DealForm
          properties={properties}
          contacts={contacts}
          action={createDeal}
        />
      )}
    </div>
  );
}
