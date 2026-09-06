"use client";

import { useRef, useState, useTransition } from "react";

import {
  checkAcquisitionOwnerDuplicates,
  createQuickAcquisition,
  createQuickAcquisitionForExistingOwner,
} from "@/app/(dashboard)/acquisitions/actions";
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
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
} from "@/lib/validations/property";

type DuplicateMatch = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
};

/**
 * "Captación rápida" (V2 bloque B): registrar una oportunidad en <30s.
 * Mismo patrón de detección de duplicados que
 * components/leads/convert-lead-form.tsx — se avisa, nunca se bloquea.
 */
export function QuickAcquisitionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  // Ref, not state — el botón "crear de todas formas" reenvía el form
  // sincrónicamente antes de que un setState se refleje (mismo motivo que
  // convert-lead-form.tsx).
  const confirmedRef = useRef(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    if (!confirmedRef.current) {
      const found = await checkAcquisitionOwnerDuplicates(formData);
      if (found.length > 0) {
        setDuplicates(found);
        return;
      }
    }

    startTransition(async () => {
      const result = await createQuickAcquisition(formData);
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
                    const formData = new FormData(formRef.current ?? undefined);
                    startTransition(async () => {
                      const result =
                        await createQuickAcquisitionForExistingOwner(
                          d.id,
                          formData,
                        );
                      if (result?.error) setError(result.error);
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
              Crear propietario nuevo de todas formas
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
          <Label htmlFor="ownerFirstName">Propietario — Nombre</Label>
          <Input id="ownerFirstName" name="ownerFirstName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerLastName">Propietario — Apellido</Label>
          <Input id="ownerLastName" name="ownerLastName" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerPhone">Teléfono</Label>
        <Input id="ownerPhone" name="ownerPhone" type="tel" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressReference">Dirección / referencia</Label>
        <Input
          id="addressReference"
          name="addressReference"
          placeholder="Ej: Calle 12 #842"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="propertyType">Tipo de propiedad</Label>
          <Select name="propertyType" items={PROPERTY_TYPE_LABELS}>
            <SelectTrigger id="propertyType" className="w-full">
              <SelectValue placeholder="¿Qué tipo es?" />
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
          <Label htmlFor="estimatedValue">Precio estimado</Label>
          <Input
            id="estimatedValue"
            name="estimatedValue"
            type="number"
            step="0.01"
          />
        </div>
      </div>

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
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" />
      </div>

      <Button type="submit" disabled={isPending}>
        Guardar captación
      </Button>
    </form>
  );
}
