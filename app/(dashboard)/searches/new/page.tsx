import { createSearch } from "@/app/(dashboard)/searches/actions";
import { SearchForm } from "@/components/searches/search-form";
import { requireMembership } from "@/lib/auth/session";
import { listContactOptions } from "@/lib/data/properties";

export default async function NewSearchPage({
  searchParams,
}: PageProps<"/searches/new">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const contactId =
    typeof params.contactId === "string" ? params.contactId : undefined;
  const leadId = typeof params.leadId === "string" ? params.leadId : undefined;

  const membership = await requireMembership();
  const contacts = await listContactOptions(membership.organization.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nueva búsqueda
        </h1>
        <p className="text-muted-foreground text-sm">
          Con el cliente, tipo y presupuesto alcanza para arrancar.
        </p>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      {contacts.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Todavía no tenés contactos. Creá uno primero para poder registrar la
          búsqueda.
        </p>
      ) : (
        <SearchForm
          contacts={contacts}
          defaultContactId={contactId}
          leadId={leadId}
          action={createSearch}
        />
      )}
    </div>
  );
}
