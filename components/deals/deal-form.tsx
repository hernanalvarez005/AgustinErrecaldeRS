import { ContactSelectField } from "@/components/contacts/contact-select-field";
import { PropertySelectField } from "@/components/properties/property-select-field";
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
} from "@/lib/validations/property";

type ContactOption = { id: string; first_name: string; last_name: string };
type PropertyOption = { id: string; title: string };

export function DealForm({
  properties,
  contacts,
  action,
}: {
  properties: PropertyOption[];
  contacts: ContactOption[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="propertyId">Propiedad</Label>
        <PropertySelectField
          id="propertyId"
          name="propertyId"
          properties={properties}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="buyerContactId">Comprador</Label>
          <ContactSelectField
            id="buyerContactId"
            name="buyerContactId"
            contacts={contacts}
            placeholder="Elegir comprador"
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sellerContactId">Vendedor</Label>
          <ContactSelectField
            id="sellerContactId"
            name="sellerContactId"
            contacts={contacts}
            placeholder="Elegir vendedor"
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dealType">Tipo de operación</Label>
          <Select
            name="dealType"
            defaultValue="sale"
            items={OPERATION_TYPE_LABELS}
          >
            <SelectTrigger id="dealType" className="w-full">
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
          <Label htmlFor="askingPrice">Precio de publicación</Label>
          <Input
            id="askingPrice"
            name="askingPrice"
            type="number"
            step="0.01"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <Select name="currency" items={{ ARS: "ARS", USD: "USD" }}>
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

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" />
      </div>

      <Button type="submit">Crear operación</Button>
    </form>
  );
}
