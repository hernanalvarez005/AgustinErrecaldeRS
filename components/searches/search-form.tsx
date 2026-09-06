import { ContactSelectField } from "@/components/contacts/contact-select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  OPERATION_TYPE_LABELS,
  OPERATION_TYPES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
} from "@/lib/validations/property";
import {
  SEARCH_OBJECTIVE_LABELS,
  SEARCH_OBJECTIVES,
  SEARCH_STATUS_LABELS,
  SEARCH_STATUSES,
  SEARCH_URGENCY_LABELS,
  SEARCH_URGENCIES,
} from "@/lib/validations/search";
import type { PropertySearch } from "@/types/database.types";

type ContactOption = { id: string; first_name: string; last_name: string };

export function SearchForm({
  search,
  contacts,
  defaultContactId,
  action,
}: {
  search?: PropertySearch;
  contacts: ContactOption[];
  defaultContactId?: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="space-y-6">
      {search ? (
        <>
          <input type="hidden" name="contactId" value={search.contact_id} />
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              name="status"
              defaultValue={search.status}
              items={SEARCH_STATUS_LABELS}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEARCH_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="contactId">Cliente</Label>
          <ContactSelectField
            id="contactId"
            name="contactId"
            contacts={contacts}
            defaultValue={defaultContactId}
            className="w-full"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Tipo de propiedad</Label>
        <div className="flex flex-wrap gap-3 rounded-md border p-3">
          {PROPERTY_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="propertyTypes"
                value={t}
                defaultChecked={search?.property_types.includes(t)}
                className="border-input size-4 rounded"
              />
              {PROPERTY_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="operationType">Operación</Label>
          <Select
            name="operationType"
            defaultValue={search?.operation_type ?? "sale"}
            items={OPERATION_TYPE_LABELS}
          >
            <SelectTrigger id="operationType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {OPERATION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="objective">Objetivo</Label>
          <Select
            name="objective"
            defaultValue={search?.objective ?? undefined}
            items={SEARCH_OBJECTIVE_LABELS}
          >
            <SelectTrigger id="objective" className="w-full">
              <SelectValue placeholder="¿Para qué busca?" />
            </SelectTrigger>
            <SelectContent>
              {SEARCH_OBJECTIVES.map((o) => (
                <SelectItem key={o} value={o}>
                  {SEARCH_OBJECTIVE_LABELS[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minPrice">Presupuesto mín.</Label>
          <Input
            id="minPrice"
            name="minPrice"
            type="number"
            step="0.01"
            defaultValue={search?.min_price ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxPrice">Presupuesto máx.</Label>
          <Input
            id="maxPrice"
            name="maxPrice"
            type="number"
            step="0.01"
            defaultValue={search?.max_price ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <Select
            name="currency"
            defaultValue={search?.currency ?? undefined}
            items={{ ARS: "ARS", USD: "USD" }}
          >
            <SelectTrigger id="currency" className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cities">Ciudades (separadas por coma)</Label>
          <Input
            id="cities"
            name="cities"
            defaultValue={search?.cities.join(", ") ?? ""}
            placeholder="La Plata"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="neighborhoods">Barrios (separados por coma)</Label>
          <Input
            id="neighborhoods"
            name="neighborhoods"
            defaultValue={search?.neighborhoods.join(", ") ?? ""}
            placeholder="Centro, City Bell"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minBedrooms">Dormitorios mín.</Label>
          <Input
            id="minBedrooms"
            name="minBedrooms"
            type="number"
            defaultValue={search?.min_bedrooms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxBedrooms">Dormitorios máx.</Label>
          <Input
            id="maxBedrooms"
            name="maxBedrooms"
            type="number"
            defaultValue={search?.max_bedrooms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="urgency">Urgencia</Label>
          <Select
            name="urgency"
            defaultValue={search?.urgency ?? undefined}
            items={SEARCH_URGENCY_LABELS}
          >
            <SelectTrigger id="urgency" className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {SEARCH_URGENCIES.map((u) => (
                <SelectItem key={u} value={u}>
                  {SEARCH_URGENCY_LABELS[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="financingRequired"
          defaultChecked={search?.financing_required}
          className="border-input size-4 rounded"
        />
        Necesita financiación
      </label>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" defaultValue={search?.notes ?? ""} />
      </div>

      <Button type="submit">
        {search ? "Guardar cambios" : "Crear búsqueda"}
      </Button>
    </form>
  );
}
