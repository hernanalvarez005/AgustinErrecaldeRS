import Link from "next/link";

import { createAcquisition } from "@/app/(dashboard)/acquisitions/actions";
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
import { requireMembership } from "@/lib/auth/session";
import { listContactOptions } from "@/lib/data/properties";
import {
  CONTACT_SOURCE_LABELS,
  CONTACT_SOURCES,
} from "@/lib/validations/contact";

export default async function NewAcquisitionPage({
  searchParams,
}: PageProps<"/acquisitions/new">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  const membership = await requireMembership();
  const contacts = await listContactOptions(membership.organization.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nueva captación
        </h1>
        <p className="text-muted-foreground text-sm">
          Registrá un propietario interesado en vender para comenzar.
        </p>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      {contacts.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Todavía no tenés contactos.{" "}
          <Link href="/contacts/new" className="underline">
            Creá uno primero
          </Link>{" "}
          para poder registrar la captación.
        </div>
      ) : (
        <form action={createAcquisition} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="contactId">Propietario</Label>
            <ContactSelectField
              id="contactId"
              name="contactId"
              contacts={contacts}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyTitle">Título de la propiedad</Label>
            <Input
              id="propertyTitle"
              name="propertyTitle"
              placeholder="Ej: Casa 3 dormitorios — City Bell"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input id="city" name="city" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="neighborhood">Barrio</Label>
              <Input id="neighborhood" name="neighborhood" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin">Origen</Label>
              <Select name="origin" items={CONTACT_SOURCE_LABELS}>
                <SelectTrigger id="origin" className="w-full">
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
              <Label htmlFor="estimatedValue">Valor estimado</Label>
              <Input
                id="estimatedValue"
                name="estimatedValue"
                type="number"
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" />
          </div>

          <Button type="submit">Crear captación</Button>
        </form>
      )}
    </div>
  );
}
