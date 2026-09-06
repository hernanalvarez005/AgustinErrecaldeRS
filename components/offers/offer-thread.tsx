"use client";

import { useState, useTransition } from "react";

import {
  acceptOfferAndCreateDeal,
  createCounterOffer,
  updateOfferStatus,
} from "@/app/(dashboard)/properties/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { OFFER_STATUS_LABELS } from "@/lib/validations/offer";
import type { PropertyOffer } from "@/lib/data/offers";

function offerStatusBadgeVariant(status: PropertyOffer["status"]) {
  if (status === "accepted") return "default" as const;
  if (status === "rejected" || status === "withdrawn" || status === "expired")
    return "outline" as const;
  return "secondary" as const;
}

function CounterOfferForm({
  offerId,
  onDone,
}: {
  offerId: string;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createCounterOffer(offerId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 space-y-2 rounded-md border p-3"
    >
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <div className="flex gap-2">
        <Input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Monto"
          required
          className="flex-1"
        />
        <Select
          name="currency"
          defaultValue="USD"
          items={{ ARS: "ARS", USD: "USD" }}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ARS">ARS</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
        <Input name="expirationDate" type="date" className="w-40" />
      </div>
      <Input name="conditions" placeholder="Condiciones (opcional)" />
      <Textarea name="notes" placeholder="Notas (opcional)" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          Guardar contraoferta
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** The full negotiation thread for a property — oldest offer first (V2 bloque E). */
export function OfferThread({
  propertyId,
  offers,
}: {
  propertyId: string;
  offers: (PropertyOffer & {
    contact: { first_name: string; last_name: string } | null;
  })[];
}) {
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isAccepting, startAccepting] = useTransition();

  function handleAccept(offerId: string) {
    setAcceptError(null);
    startAccepting(async () => {
      const result = await acceptOfferAndCreateDeal(offerId);
      if (result?.error) setAcceptError(result.error);
    });
  }

  if (offers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Sin ofertas registradas todavía.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {acceptError ? (
        <li className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {acceptError}
        </li>
      ) : null}
      {offers.map((offer) => (
        <li key={offer.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {offer.contact
                ? `${offer.contact.first_name} ${offer.contact.last_name}`
                : "Contacto"}{" "}
              · {offer.currency} {offer.amount.toLocaleString("es-AR")}
            </span>
            <Badge variant={offerStatusBadgeVariant(offer.status)}>
              {OFFER_STATUS_LABELS[offer.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs">
            {formatDate(offer.created_at)}
            {offer.expiration_date
              ? ` · Vence ${formatDate(offer.expiration_date)}`
              : ""}
          </p>
          {offer.conditions ? (
            <p className="text-muted-foreground">{offer.conditions}</p>
          ) : null}
          {offer.notes ? (
            <p className="text-muted-foreground">{offer.notes}</p>
          ) : null}

          {offer.status === "pending" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isAccepting}
                onClick={() => handleAccept(offer.id)}
              >
                Aceptar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCounteringId(offer.id)}
              >
                Contraoferta
              </Button>
              <form
                action={updateOfferStatus.bind(
                  null,
                  offer.id,
                  propertyId,
                  "rejected",
                )}
              >
                <Button type="submit" size="sm" variant="ghost">
                  Rechazar
                </Button>
              </form>
              <form
                action={updateOfferStatus.bind(
                  null,
                  offer.id,
                  propertyId,
                  "withdrawn",
                )}
              >
                <Button type="submit" size="sm" variant="ghost">
                  Retirar
                </Button>
              </form>
            </div>
          ) : null}

          {counteringId === offer.id ? (
            <CounterOfferForm
              offerId={offer.id}
              onDone={() => setCounteringId(null)}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
