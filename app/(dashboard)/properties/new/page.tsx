import { createProperty } from "@/app/(dashboard)/properties/actions";
import { PropertyForm } from "@/components/properties/property-form";

export default async function NewPropertyPage({
  searchParams,
}: PageProps<"/properties/new">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nueva propiedad
        </h1>
        <p className="text-muted-foreground text-sm">
          Con el título, tipo y operación alcanza para arrancar — podés
          completar el resto después.
        </p>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      <PropertyForm action={createProperty} />
    </div>
  );
}
