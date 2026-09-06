"use client";

import { useRef, useState, useTransition } from "react";

import {
  checkLeadDuplicates,
  convertLeadToExistingContact,
  convertLeadToNewContact,
} from "@/app/(dashboard)/leads/actions";
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
  CONTACT_SOURCE_LABELS,
  CONTACT_SOURCES,
} from "@/lib/validations/contact";
import type { Lead } from "@/types/database.types";

type DuplicateMatch = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
};

export function ConvertLeadForm({ lead }: { lead: Lead }) {
  const formRef = useRef<HTMLFormElement>(null);
  // A ref, not state — see contact-form.tsx for why: the "crear de todas
  // formas" button submits synchronously right after setting this, before
  // React would re-render a state update.
  const confirmedRef = useRef(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    if (!confirmedRef.current) {
      const found = await checkLeadDuplicates(formData);
      if (found.length > 0) {
        setDuplicates(found);
        return;
      }
    }

    startTransition(async () => {
      const result = await convertLeadToNewContact(lead.id, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
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
              <li
                key={d.id}
                className="flex items-center justify-between gap-2"
              >
                <span>
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
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await convertLeadToExistingContact(lead.id, d.id);
                    });
                  }}
                >
                  Usar este contacto
                </Button>
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
              Crear contacto nuevo de todas formas
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
            defaultValue={lead.first_name}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={lead.last_name ?? ""}
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
            defaultValue={lead.phone ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={lead.email ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="source">Origen</Label>
        <Select
          name="source"
          defaultValue={lead.source ?? undefined}
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

      <Button type="submit" disabled={isPending}>
        Convertir en contacto
      </Button>
    </form>
  );
}
