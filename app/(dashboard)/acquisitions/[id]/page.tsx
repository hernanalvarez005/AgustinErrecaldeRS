import Link from "next/link";
import { notFound } from "next/navigation";

import {
  markAcquisitionLost,
  createValuation,
} from "@/app/(dashboard)/acquisitions/actions";
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
import { getAcquisition, getValuations } from "@/lib/data/acquisitions";
import { getActivities, getNotes, getTasks } from "@/lib/data/engagement";
import { getProperty } from "@/lib/data/properties";
import { formatDate } from "@/lib/format";
import {
  ACTIVITY_TYPE_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
} from "@/lib/validations/activity";
import { ACQUISITION_STATUS_LABELS } from "@/lib/validations/acquisition";
import { CONTACT_SOURCE_LABELS } from "@/lib/validations/contact";
import { TASK_PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/validations/task";
import { createClient } from "@/lib/supabase/server";

async function getOwner(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("id", contactId)
    .single();
  return data;
}

export default async function AcquisitionDetailPage({
  params,
}: PageProps<"/acquisitions/[id]">) {
  const { id } = await params;

  const acquisition = await getAcquisition(id);
  if (!acquisition) notFound();

  const [property, owner, valuations, notes, tasks, activities] =
    await Promise.all([
      getProperty(acquisition.property_id),
      getOwner(acquisition.primary_owner_contact_id),
      getValuations(id),
      getNotes({ acquisitionId: id }),
      getTasks({ acquisitionId: id }),
      getActivities({ acquisitionId: id }),
    ]);

  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  const timeline = buildTimeline({ notes, activities, tasks });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {property?.title ?? "Propiedad sin título"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{ACQUISITION_STATUS_LABELS[acquisition.status]}</Badge>
          {acquisition.origin ? (
            <span className="text-muted-foreground text-sm">
              Origen: {CONTACT_SOURCE_LABELS[acquisition.origin]}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          Propietario:{" "}
          {owner ? (
            <Link href={`/contacts/${owner.id}`} className="hover:underline">
              {owner.first_name} {owner.last_name}
            </Link>
          ) : (
            "—"
          )}
          {acquisition.estimated_value
            ? ` · Estimado ${acquisition.estimated_value.toLocaleString("es-AR")}`
            : ""}
        </p>
        {property ? (
          <Link
            href={`/properties/${property.id}`}
            className="text-sm underline"
          >
            Ver ficha de la propiedad
          </Link>
        ) : null}
      </div>

      {acquisition.status !== "lost" && acquisition.status !== "won" ? (
        <Card>
          <CardContent className="pt-6">
            <form
              action={markAcquisitionLost.bind(null, acquisition.id)}
              className="flex items-end gap-2"
            >
              <div className="flex-1 space-y-2">
                <label
                  className="text-muted-foreground text-sm"
                  htmlFor="lostReason"
                >
                  Marcar como perdida (opcional: motivo)
                </label>
                <Input
                  id="lostReason"
                  name="lostReason"
                  placeholder="Motivo (opcional)"
                />
              </div>
              <Button type="submit" variant="outline">
                Marcar perdida
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tasaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {valuations.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin tasaciones registradas.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {valuations.map((v) => (
                <li key={v.id} className="rounded-md border p-2">
                  <p>
                    {v.currency ?? ""} {v.estimated_min_value ?? "?"} –{" "}
                    {v.estimated_max_value ?? "?"}
                    {v.estimated_value
                      ? ` (est. ${v.estimated_value.toLocaleString("es-AR")})`
                      : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDate(v.valuation_date)}
                    {v.recommended_listing_price
                      ? ` · Precio sugerido: ${v.recommended_listing_price.toLocaleString("es-AR")}`
                      : ""}
                  </p>
                  {v.notes ? (
                    <p className="text-muted-foreground">{v.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {property ? (
            <form
              action={createValuation.bind(null, property.id, acquisition.id)}
              className="grid grid-cols-2 gap-2 border-t pt-4"
            >
              <Input
                name="estimatedMinValue"
                type="number"
                step="0.01"
                placeholder="Mínimo"
              />
              <Input
                name="estimatedMaxValue"
                type="number"
                step="0.01"
                placeholder="Máximo"
              />
              <Input
                name="estimatedValue"
                type="number"
                step="0.01"
                placeholder="Estimado"
              />
              <Select name="currency" items={{ ARS: "ARS", USD: "USD" }}>
                <SelectTrigger>
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <Input name="valuationDate" type="date" />
              <Input
                name="recommendedListingPrice"
                type="number"
                step="0.01"
                placeholder="Precio sugerido de publicación"
                className="col-span-2"
              />
              <Textarea
                name="notes"
                placeholder="Notas"
                className="col-span-2"
              />
              <Button type="submit" variant="outline" className="col-span-2">
                Registrar tasación
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registrar actividad</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={logActivity.bind(null, { acquisitionId: acquisition.id })}
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
                      { acquisitionId: acquisition.id },
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
            action={createTask.bind(null, { acquisitionId: acquisition.id })}
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
            action={addNote.bind(null, { acquisitionId: acquisition.id })}
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
