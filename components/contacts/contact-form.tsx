"use client";

import { useRef, useState, useTransition } from "react";

import {
  checkContactDuplicates,
  createContact,
  updateContact,
} from "@/app/(dashboard)/contacts/actions";
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
import {
  CONTACT_ROLE_LABELS,
  CONTACT_ROLES,
  CONTACT_SOURCE_LABELS,
  CONTACT_SOURCES,
} from "@/lib/validations/contact";
import type { Contact, ContactRole } from "@/types/database.types";

type DuplicateMatch = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
};

export function ContactForm({
  contact,
  initialRoles,
}: {
  contact?: Contact;
  initialRoles?: ContactRole[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // A ref, not state: the "create anyway" button calls requestSubmit()
  // synchronously right after setting this, and a new submit event fires
  // before React re-renders — a state flag would still read stale (false)
  // in that immediately-following handleSubmit call.
  const confirmedRef = useRef(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    if (!confirmedRef.current) {
      const found = await checkContactDuplicates(formData);
      if (found.length > 0) {
        setDuplicates(found);
        return;
      }
    }

    startTransition(async () => {
      const result = contact
        ? await updateContact(contact.id, formData)
        : await createContact(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {contact ? (
        <input type="hidden" name="contactId" value={contact.id} />
      ) : null}

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      {duplicates.length > 0 ? (
        <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm">
          <p className="font-medium">
            Encontramos un posible contacto existente:
          </p>
          <ul className="space-y-1">
            {duplicates.map((d) => (
              <li key={d.id}>
                <a
                  href={`/contacts/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {d.first_name} {d.last_name}
                </a>{" "}
                <span className="text-muted-foreground">
                  {d.phone || d.email}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                confirmedRef.current = true;
                setDuplicates([]);
                formRef.current?.requestSubmit();
              }}
            >
              {contact ? "Guardar de todas formas" : "Crear de todas formas"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setDuplicates([])}
            >
              Revisar datos
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={contact?.first_name}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={contact?.last_name}
            required
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
            defaultValue={contact?.phone ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            defaultValue={contact?.whatsapp ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={contact?.email ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dni">DNI</Label>
          <Input id="dni" name="dni" defaultValue={contact?.dni ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="birthDate">Fecha de nacimiento</Label>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={contact?.birth_date ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Origen</Label>
          <Select
            name="source"
            defaultValue={contact?.source ?? undefined}
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            name="address"
            defaultValue={contact?.address ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profession">Profesión</Label>
          <Input
            id="profession"
            name="profession"
            defaultValue={contact?.profession ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Roles</Label>
        <div className="flex flex-wrap gap-3 rounded-md border p-3">
          {CONTACT_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="roles"
                value={role}
                defaultChecked={initialRoles?.includes(role)}
                className="border-input size-4 rounded"
              />
              {CONTACT_ROLE_LABELS[role]}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {contact ? "Guardar cambios" : "Crear contacto"}
      </Button>
    </form>
  );
}
