import { notFound } from "next/navigation";

import { updateProperty } from "@/app/(dashboard)/properties/actions";
import { PropertyForm } from "@/components/properties/property-form";
import { getProperty } from "@/lib/data/properties";

export default async function EditPropertyPage({
  params,
  searchParams,
}: PageProps<"/properties/[id]/edit">) {
  const { id } = await params;
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;

  const property = await getProperty(id);
  if (!property) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Editar {property.title}
        </h1>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      <PropertyForm
        property={property}
        action={updateProperty.bind(null, property.id)}
      />
    </div>
  );
}
