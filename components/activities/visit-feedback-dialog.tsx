"use client";

import { useState, useTransition } from "react";

import { finalizeVisit } from "@/app/(dashboard)/calendar/actions";
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  VISIT_INTEREST_LEVEL_LABELS,
  VISIT_INTEREST_LEVELS,
  VISIT_PRICE_PERCEPTION_LABELS,
  VISIT_PRICE_PERCEPTIONS,
  VISIT_WANTS_TO_PROCEED_LABELS,
  VISIT_WANTS_TO_PROCEED_OPTIONS,
} from "@/lib/validations/visit-feedback";

/**
 * "Finalizar visita" (V2 bloque D): a visit-type event's completion
 * action opens this instead of completing immediately — the advisor
 * closes out interest level, price perception, and an optional follow-up
 * task without losing their place on the calendar. A side sheet rather
 * than a centered dialog since V2.1 (Bloque UI-6, spec point 56 — one of
 * the drawer candidates it names explicitly): the form has 7 fields, more
 * than "a confirmation or a small decision" (spec point 57's boundary for
 * when a dialog is still the right call).
 */
export function VisitFeedbackDialog({ activityId }: { activityId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await finalizeVisit(activityId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" variant="ghost" />}>
        Finalizar visita
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Finalizar visita</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
        >
          {error ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="interestLevel">Nivel de interés</Label>
            <Select name="interestLevel" items={VISIT_INTEREST_LEVEL_LABELS}>
              <SelectTrigger id="interestLevel" className="w-full">
                <SelectValue placeholder="¿Cómo se fue?" />
              </SelectTrigger>
              <SelectContent>
                {VISIT_INTEREST_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {VISIT_INTEREST_LEVEL_LABELS[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="positiveFeedback">Qué le gustó</Label>
            <Textarea id="positiveFeedback" name="positiveFeedback" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="negativeFeedback">Qué no le gustó</Label>
            <Textarea id="negativeFeedback" name="negativeFeedback" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pricePerception">Percepción del precio</Label>
              <Select
                name="pricePerception"
                items={VISIT_PRICE_PERCEPTION_LABELS}
              >
                <SelectTrigger id="pricePerception" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_PRICE_PERCEPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {VISIT_PRICE_PERCEPTION_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wantsToProceed">Quiere avanzar</Label>
              <Select
                name="wantsToProceed"
                items={VISIT_WANTS_TO_PROCEED_LABELS}
              >
                <SelectTrigger id="wantsToProceed" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_WANTS_TO_PROCEED_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {VISIT_WANTS_TO_PROCEED_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observaciones</Label>
            <Textarea id="notes" name="notes" />
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="followUpTitle">Próxima acción (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="followUpTitle"
                name="followUpTitle"
                placeholder="Ej: Llamar mañana"
                className="flex-1"
              />
              <Input name="followUpDueAt" type="date" className="w-40" />
            </div>
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              Guardar y finalizar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
