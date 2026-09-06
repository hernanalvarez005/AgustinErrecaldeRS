import Link from "next/link";
import { notFound } from "next/navigation";

import { updateDealTerms } from "@/app/(dashboard)/deals/actions";
import { buildTimeline, Timeline } from "@/components/contacts/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addNote,
  completeTask,
  createTask,
  logActivity,
} from "@/lib/actions/engagement";
import { getDeal } from "@/lib/data/deals";
import { getActivities, getNotes, getTasks } from "@/lib/data/engagement";
import { getProperty } from "@/lib/data/properties";
import { formatDate } from "@/lib/format";
import {
  ACTIVITY_TYPE_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
} from "@/lib/validations/activity";
import { DEAL_STATUS_LABELS } from "@/lib/validations/deal";
import { OPERATION_TYPE_LABELS } from "@/lib/validations/property";
import { TASK_PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/validations/task";
import { createClient } from "@/lib/supabase/server";

async function getContact(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("id", contactId)
    .single();
  return data;
}

function formatPrice(value: number | null, currency: "ARS" | "USD" | null) {
  if (!value || !currency) return null;
  return `${currency} ${value.toLocaleString("es-AR")}`;
}

export default async function DealDetailPage({
  params,
  searchParams,
}: PageProps<"/deals/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;

  const deal = await getDeal(id);
  if (!deal) notFound();

  const [property, buyer, seller, notes, tasks, activities] = await Promise.all(
    [
      getProperty(deal.property_id),
      getContact(deal.buyer_contact_id),
      getContact(deal.seller_contact_id),
      getNotes({ dealId: id }),
      getTasks({ dealId: id }),
      getActivities({ dealId: id }),
    ],
  );

  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  const timeline = buildTimeline({ notes, activities, tasks });
  const price = formatPrice(
    deal.agreed_price ?? deal.offer_price ?? deal.asking_price,
    deal.currency,
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {property?.title ?? "Propiedad sin título"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{DEAL_STATUS_LABELS[deal.status]}</Badge>
          <Badge variant="secondary">
            {OPERATION_TYPE_LABELS[deal.deal_type]}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Comprador:{" "}
          {buyer ? (
            <Link href={`/contacts/${buyer.id}`} className="hover:underline">
              {buyer.first_name} {buyer.last_name}
            </Link>
          ) : (
            "—"
          )}
          {" · "}
          Vendedor:{" "}
          {seller ? (
            <Link href={`/contacts/${seller.id}`} className="hover:underline">
              {seller.first_name} {seller.last_name}
            </Link>
          ) : (
            "—"
          )}
        </p>
        {price ? (
          <p className="text-muted-foreground text-sm">{price}</p>
        ) : null}
        {property ? (
          <Link
            href={`/properties/${property.id}`}
            className="text-sm underline"
          >
            Ver ficha de la propiedad
          </Link>
        ) : null}
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Precios y fechas clave</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            key={deal.updated_at}
            action={updateDealTerms.bind(null, deal.id)}
            className="grid grid-cols-2 gap-4"
          >
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="offerPrice"
              >
                Oferta
              </label>
              <Input
                id="offerPrice"
                name="offerPrice"
                type="number"
                step="0.01"
                defaultValue={deal.offer_price ?? ""}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="agreedPrice"
              >
                Precio acordado
              </label>
              <Input
                id="agreedPrice"
                name="agreedPrice"
                type="number"
                step="0.01"
                defaultValue={deal.agreed_price ?? ""}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="currency"
              >
                Moneda
              </label>
              <Select
                name="currency"
                defaultValue={deal.currency ?? undefined}
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
            <div />
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="reservationDate"
              >
                Fecha de reserva
              </label>
              <Input
                id="reservationDate"
                name="reservationDate"
                type="date"
                defaultValue={deal.reservation_date ?? ""}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="contractDate"
              >
                Fecha de boleto/contrato
              </label>
              <Input
                id="contractDate"
                name="contractDate"
                type="date"
                defaultValue={deal.contract_date ?? ""}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="closingDate"
              >
                Fecha de escrituración
              </label>
              <Input
                id="closingDate"
                name="closingDate"
                type="date"
                defaultValue={deal.closing_date ?? ""}
              />
            </div>
            <div />
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="estimatedCommission"
              >
                Comisión estimada
              </label>
              <Input
                id="estimatedCommission"
                name="estimatedCommission"
                type="number"
                step="0.01"
                defaultValue={deal.estimated_commission ?? ""}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="commissionCurrency"
              >
                Moneda de la comisión
              </label>
              <Select
                name="commissionCurrency"
                defaultValue={deal.commission_currency ?? undefined}
                items={{ ARS: "ARS", USD: "USD" }}
              >
                <SelectTrigger id="commissionCurrency" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-muted-foreground text-sm" htmlFor="notes">
                Notas
              </label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={deal.notes ?? ""}
              />
            </div>
            <Button type="submit" variant="outline" className="col-span-2">
              Guardar términos
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Registrar actividad</CardTitle>
          <Button
            render={<Link href={`/calendar/new?dealId=${deal.id}`} />}
            nativeButton={false}
            variant="ghost"
            size="sm"
          >
            + Agendar
          </Button>
        </CardHeader>
        <CardContent>
          <form
            action={logActivity.bind(null, { dealId: deal.id })}
            className="flex flex-wrap items-end gap-2"
          >
            <Select
              name="type"
              defaultValue={LOGGABLE_ACTIVITY_TYPES[0]}
              items={Object.fromEntries(
                LOGGABLE_ACTIVITY_TYPES.map((type) => [
                  type,
                  ACTIVITY_TYPE_LABELS[type],
                ]),
              )}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGGABLE_ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ACTIVITY_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              name="description"
              placeholder="Detalle (opcional)"
              className="max-w-xs flex-1"
            />
            <Button type="submit" variant="outline">
              Registrar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tareas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingTasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin tareas pendientes.
            </p>
          ) : (
            <ul className="space-y-2">
              {pendingTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{task.title}</span>{" "}
                    <span className="text-muted-foreground">
                      · {TASK_PRIORITY_LABELS[task.priority]}
                      {task.due_at ? ` · ${formatDate(task.due_at)}` : ""}
                    </span>
                  </div>
                  <form
                    action={completeTask.bind(
                      null,
                      { dealId: deal.id },
                      task.id,
                    )}
                  >
                    <Button type="submit" size="sm" variant="ghost">
                      Completar
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form
            action={createTask.bind(null, { dealId: deal.id })}
            className="flex flex-wrap items-end gap-2 border-t pt-4"
          >
            <Input
              name="title"
              placeholder="Nueva tarea"
              className="max-w-xs flex-1"
              required
            />
            <Select
              name="priority"
              defaultValue="medium"
              items={TASK_PRIORITY_LABELS}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input name="dueAt" type="date" className="w-40" />
            <Button type="submit" variant="outline">
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={addNote.bind(null, { dealId: deal.id })}
            className="space-y-2"
          >
            <Textarea name="body" placeholder="Agregar una nota..." required />
            <Button type="submit" variant="outline">
              Guardar nota
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline entries={timeline} />
        </CardContent>
      </Card>
    </div>
  );
}
