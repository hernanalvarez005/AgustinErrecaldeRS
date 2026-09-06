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
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
} from "@/lib/validations/property";
import type { Property } from "@/types/database.types";

export function PropertyForm({
  property,
  action,
}: {
  property?: Property;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            name="title"
            placeholder="Ej: Departamento 2 dormitorios — Centro"
            defaultValue={property?.title}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="propertyType">Tipo</Label>
          <Select
            name="propertyType"
            defaultValue={property?.property_type ?? "apartment"}
            items={PROPERTY_TYPE_LABELS}
          >
            <SelectTrigger id="propertyType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="operationType">Operación</Label>
          <Select
            name="operationType"
            defaultValue={property?.operation_type ?? "sale"}
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
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="street">Calle</Label>
          <Input
            id="street"
            name="street"
            defaultValue={property?.street ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="streetNumber">Altura</Label>
          <Input
            id="streetNumber"
            name="streetNumber"
            defaultValue={property?.street_number ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">Ciudad</Label>
          <Input id="city" name="city" defaultValue={property?.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Barrio</Label>
          <Input
            id="neighborhood"
            name="neighborhood"
            defaultValue={property?.neighborhood ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="province">Provincia</Label>
          <Input
            id="province"
            name="province"
            defaultValue={property?.province ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Precio</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            defaultValue={property?.price ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <Select
            name="currency"
            defaultValue={property?.currency ?? undefined}
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
        <div className="space-y-2">
          <Label htmlFor="expenses">Expensas</Label>
          <Input
            id="expenses"
            name="expenses"
            type="number"
            step="0.01"
            defaultValue={property?.expenses ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bedrooms">Dormitorios</Label>
          <Input
            id="bedrooms"
            name="bedrooms"
            type="number"
            defaultValue={property?.bedrooms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bathrooms">Baños</Label>
          <Input
            id="bathrooms"
            name="bathrooms"
            type="number"
            defaultValue={property?.bathrooms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="garageSpaces">Cocheras</Label>
          <Input
            id="garageSpaces"
            name="garageSpaces"
            type="number"
            defaultValue={property?.garage_spaces ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalArea">Sup. total (m²)</Label>
          <Input
            id="totalArea"
            name="totalArea"
            type="number"
            step="0.01"
            defaultValue={property?.total_area ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="coveredArea">Sup. cubierta (m²)</Label>
          <Input
            id="coveredArea"
            name="coveredArea"
            type="number"
            step="0.01"
            defaultValue={property?.covered_area ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select
            name="status"
            defaultValue={property?.status ?? "draft"}
            items={PROPERTY_STATUS_LABELS}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROPERTY_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={property?.description ?? ""}
        />
      </div>

      <Button type="submit">
        {property ? "Guardar cambios" : "Crear propiedad"}
      </Button>
    </form>
  );
}
