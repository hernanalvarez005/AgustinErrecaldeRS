import { notFound } from "next/navigation";

import { updateSearch } from "@/app/(dashboard)/searches/actions";
import { SearchForm } from "@/components/searches/search-form";
import { getSearch } from "@/lib/data/searches";

export default async function EditSearchPage({
  params,
  searchParams,
}: PageProps<"/searches/[id]/edit">) {
  const { id } = await params;
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;

  const search = await getSearch(id);
  if (!search) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Editar búsqueda
        </h1>
      </div>
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      <SearchForm
        search={search}
        contacts={[]}
        action={updateSearch.bind(null, search.id)}
      />
    </div>
  );
}
