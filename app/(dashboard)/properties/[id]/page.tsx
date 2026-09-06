import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addOwner, removeOwner } from "@/app/(dashboard)/properties/actions";
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
import { buildTimeline, Timeline } from "@/components/contacts/timeline";
import { requireMembership } from "@/lib/auth/session";
import {
  addNote,
  completeTask,
  createTask,
  logActivity,
} from "@/lib/actions/engagement";
import { getActivities, getNotes, getTasks } from "@/lib/data/engagement";
import {
  getProperty,
  getPropertyOwners,
  listContactOptions,
} from "@/lib/data/properties";
import { formatDate } from "@/lib/format";
import {
  ACTIVITY_TYPE_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
} from "@/lib/validations/activity";
import {
  OPERATION_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/validations/property";
import { TASK_PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/validations/task";

function formatPrice(price: number | null, currency: string | null) {
  if (price === null || currency === null) return null;
  return `${currency} ${price.toLocaleString("es-AR")}`;
}

export default async function PropertyDetailPage({
  params,
}: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const membership = await requireMembership();

  const [property, owners, contactOptions, notes, tasks, activities] =
    await Promise.all([
      getProperty(id),
      getPropertyOwners(id),
      listContactOptions(membership.organization.id),
      getNotes({ propertyId: id }),
      getTasks({ propertyId: id }),
      getActivities({ propertyId: id }),
    ]);

  if (!property) notFound();

  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  const price = formatPrice(property.price, property.currency);
  const address = [property.street, property.street_number]
    .filter(Boolean)
    .join(" ");
  const zone = [property.neighborhood, property.city]
    .filter(Boolean)
    .join(", ");
  const availableContacts = contactOptions.filter(
    (c) => !owners.some((o) => o.contact_id === c.id),
  );

  const timeline = buildTimeline({ notes, activities, tasks });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {property.title}
            </h1>
            <Button
              render={<Link href={`/properties/${property.id}/edit`} />}
              nativeButton={false}
              variant="ghost"
              size="icon-sm"
            >
              <Pencil />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">
              {PROPERTY_TYPE_LABELS[property.property_type]}
            </Badge>
            <Badge variant="secondary">
              {OPERATION_TYPE_LABELS[property.operation_type]}
            </Badge>
            <Badge>{PROPERTY_STATUS_LABELS[property.status]}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {[address, zone].filter(Boolean).join(" · ") ||
              "Sin dirección cargada"}
            {price ? ` · ${price}` : ""}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Propietarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {owners.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin propietarios asociados.
            </p>
          ) : (
            <ul className="space-y-2">
              {owners.map((owner) => (
                <li
                  key={owner.contact_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <Link
                      href={`/contacts/${owner.contact_id}`}
                      className="font-medium hover:underline"
                    >
                      {owner.contact.first_name} {owner.contact.last_name}
                    </Link>
                    <span className="text-muted-foreground">
                      {owner.is_primary_contact ? " · Principal" : ""}
                      {owner.ownership_percentage
                        ? ` · ${owner.ownership_percentage}%`
                        : ""}
                    </span>
                  </div>
                  <form
                    action={removeOwner.bind(
                      null,
                      property.id,
                      owner.contact_id,
                    )}
                  >
                    <Button type="submit" size="icon-sm" variant="ghost">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {availableContacts.length > 0 ? (
            <form
              action={addOwner.bind(null, property.id)}
              className="flex flex-wrap items-end gap-2 border-t pt-4"
            >
              <Select
                name="contactId"
                items={Object.fromEntries(
                  availableContacts.map((c) => [
                    c.id,
                    `${c.first_name} ${c.last_name}`,
                  ]),
                )}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Elegir contacto" />
                </SelectTrigger>
                <SelectContent>
                  {availableContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                name="ownershipPercentage"
                type="number"
                step="0.01"
                placeholder="% (opcional)"
                className="w-32"
              />
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="isPrimaryContact"
                  className="border-input size-4 rounded"
                />
                Principal
              </label>
              <Button type="submit" variant="outline">
                Agregar propietario
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
            action={logActivity.bind(null, { propertyId: property.id })}
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
                      { propertyId: property.id },
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
            action={createTask.bind(null, { propertyId: property.id })}
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
            action={addNote.bind(null, { propertyId: property.id })}
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
