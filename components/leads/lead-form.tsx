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
  CONTACT_SOURCE_LABELS,
  CONTACT_SOURCES,
} from "@/lib/validations/contact";
import type { Lead } from "@/types/database.types";

type PropertyOption = { id: string; title: string };

export function LeadForm({
  lead,
  properties,
  action,
}: {
  lead?: Lead;
  properties: PropertyOption[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={lead?.first_name}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={lead?.last_name ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={lead?.phone ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={lead?.email ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="source">Origen</Label>
          <Select
            name="source"
            defaultValue={lead?.source ?? undefined}
            items={CONTACT_SOURCE_LABELS}
          >
            <SelectTrigger id="source" className="w-full">
              <SelectValue placeholder="¿Cómo llegó?" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CONTACT_SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="propertyId">Propiedad de interés</Label>
          {properties.length === 0 ? (
            // No properties yet in the org — a Select with a single "Ninguna"
            // item would hit the Base UI single-item bug (docs/ARCHITECTURE.md),
            // so degrade to a fixed hidden input, same trick as ContactSelectField.
            <input type="hidden" name="propertyId" value="none" />
          ) : (
            <Select
              name="propertyId"
              defaultValue={lead?.property_id ?? "none"}
              items={{
                none: "Ninguna",
                ...Object.fromEntries(properties.map((p) => [p.id, p.title])),
              }}
            >
              <SelectTrigger id="propertyId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguna</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Mensaje original</Label>
        <Textarea
          id="message"
          name="message"
          placeholder="Lo que escribió el lead..."
          defaultValue={lead?.message ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas internas</Label>
        <Textarea id="notes" name="notes" defaultValue={lead?.notes ?? ""} />
      </div>

      <Button type="submit">{lead ? "Guardar cambios" : "Crear lead"}</Button>
    </form>
  );
}
