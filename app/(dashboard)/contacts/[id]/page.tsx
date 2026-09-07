import { Mail, MessageCircle, Pencil, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/shared/status-badge";
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
import { VisitFeedbackList } from "@/components/activities/visit-feedback-list";
import {
  addNote,
  completeTask,
  createTask,
  logActivity,
} from "@/lib/actions/engagement";
import { getContact, getContactRoles } from "@/lib/data/contacts";
import { getActivities, getNotes, getTasks } from "@/lib/data/engagement";
import { getRecommendationsForContact } from "@/lib/data/recommendations";
import { listSearchesByContact } from "@/lib/data/searches";
import { getVisitFeedbackForContact } from "@/lib/data/visit-feedback";
import {
  formatBudget,
  formatDate,
  formatDateTime,
  formatEventDay,
} from "@/lib/format";
import { toWhatsAppLink } from "@/lib/phone";
import { searchStatusTone, taskPriorityTone } from "@/lib/status-tone";
import {
  ACTIVITY_TYPE_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
} from "@/lib/validations/activity";
import { CONTACT_ROLE_LABELS } from "@/lib/validations/contact";
import {
  OPERATION_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/validations/property";
import {
  RECOMMENDATION_CHANNEL_LABELS,
  RECOMMENDATION_STATUS_LABELS,
} from "@/lib/validations/recommendation";
import {
  SEARCH_OBJECTIVE_LABELS,
  SEARCH_STATUS_LABELS,
  SEARCH_URGENCY_LABELS,
} from "@/lib/validations/search";
import { TASK_PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/validations/task";

/** Small, muted, discreet group label — spec point 23 ("no debe competir
 * con navegación"), reused here for the same jerarquía-por-agrupación idea
 * inside a ficha instead of the sidebar. Plain text, not a new component:
 * a single className string wasn't worth a wrapper. */
const GROUP_LABEL_CLASS =
  "text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase";

export default async function ContactDetailPage({
  params,
}: PageProps<"/contacts/[id]">) {
  const { id } = await params;

  const [
    contact,
    roles,
    searches,
    notes,
    tasks,
    activities,
    visitFeedback,
    recommendations,
  ] = await Promise.all([
    getContact(id),
    getContactRoles(id),
    listSearchesByContact(id),
    getNotes({ contactId: id }),
    getTasks({ contactId: id }),
    getActivities({ contactId: id }),
    getVisitFeedbackForContact(id),
    getRecommendationsForContact(id),
  ]);

  if (!contact) notFound();

  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  const lastInteraction = activities
    .filter((a) => a.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    )[0];
  const nextAction = pendingTasks
    .filter((t) => t.due_at)
    .sort(
      (a, b) =>
        new Date(a.due_at as string).getTime() -
        new Date(b.due_at as string).getTime(),
    )[0];

  const timeline = buildTimeline({ notes, activities, tasks });

  const personalDataRows = [
    { label: "DNI", value: contact.dni },
    { label: "Dirección", value: contact.address },
    { label: "Profesión", value: contact.profession },
    {
      label: "Fecha de nacimiento",
      value: contact.birth_date ? formatDate(contact.birth_date) : null,
    },
  ].filter((row) => row.value);

  return (
    <div className="max-w-3xl space-y-6">
      {/* IDENTIDAD */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {contact.first_name} {contact.last_name}
            </h1>
            <Button
              render={<Link href={`/contacts/${contact.id}/edit`} />}
              nativeButton={false}
              variant="ghost"
              size="icon-sm"
            >
              <Pencil />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {roles.length === 0 ? (
              <span className="text-muted-foreground text-sm">
                Sin roles asignados
              </span>
            ) : (
              roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {CONTACT_ROLE_LABELS[role]}
                </Badge>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {contact.phone ? (
            <Button
              render={<a href={`tel:${contact.phone}`} />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              <Phone /> Llamar
            </Button>
          ) : null}
          {contact.whatsapp || contact.phone ? (
            <Button
              render={
                <a
                  href={toWhatsAppLink(contact.whatsapp || contact.phone || "")}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              <MessageCircle /> WhatsApp
            </Button>
          ) : null}
          {contact.email ? (
            <Button
              render={<a href={`mailto:${contact.email}`} />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              <Mail /> Email
            </Button>
          ) : null}
          <Button
            render={<Link href={`/calendar/new?contactId=${contact.id}`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            + Agendar
          </Button>
          <Button
            render={<Link href="#tareas" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            + Tarea
          </Button>
        </div>
      </div>

      {/* NECESIDAD */}
      <div className="space-y-2">
        <p className={GROUP_LABEL_CLASS}>Necesidad</p>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Búsquedas</CardTitle>
            <Button
              render={<Link href={`/searches/new?contactId=${contact.id}`} />}
              nativeButton={false}
              variant="ghost"
              size="sm"
            >
              + Nueva búsqueda
            </Button>
          </CardHeader>
          <CardContent>
            {searches.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sin búsquedas registradas.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {searches.map((s) => {
                  const zone = [...s.cities, ...s.neighborhoods].join(", ");
                  const bedrooms =
                    s.min_bedrooms !== null
                      ? `${s.min_bedrooms}+ dormitorios`
                      : null;
                  return (
                    <li key={s.id} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/searches/${s.id}`}
                          className="font-medium hover:underline"
                        >
                          {s.property_types.length > 0
                            ? s.property_types
                                .map((t) => PROPERTY_TYPE_LABELS[t])
                                .join(", ")
                            : "Búsqueda"}
                        </Link>
                        <StatusBadge tone={searchStatusTone(s.status)}>
                          {SEARCH_STATUS_LABELS[s.status]}
                        </StatusBadge>
                      </div>
                      <p className="text-muted-foreground">
                        {OPERATION_TYPE_LABELS[s.operation_type]}
                        {zone ? ` · ${zone}` : ""}
                        {bedrooms ? ` · ${bedrooms}` : ""}
                        {" · "}
                        {formatBudget(s.min_price, s.max_price, s.currency)}
                      </p>
                      {s.objective || s.urgency ? (
                        <p className="text-muted-foreground">
                          {s.objective
                            ? SEARCH_OBJECTIVE_LABELS[s.objective]
                            : ""}
                          {s.objective && s.urgency ? " · " : ""}
                          {s.urgency
                            ? `Urgencia: ${SEARCH_URGENCY_LABELS[s.urgency]}`
                            : ""}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ÚLTIMO CONTACTO / PRÓXIMA ACCIÓN */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm">
          <div>
            <dt className="text-muted-foreground">Última interacción</dt>
            <dd>
              {lastInteraction
                ? formatDateTime(lastInteraction.starts_at)
                : "—"}
            </dd>
          </div>
          <div className="border-primary/30 border-l-2 pl-3">
            <dt className="text-muted-foreground">Próxima acción</dt>
            <dd className="font-medium">
              {nextAction
                ? `${nextAction.title} · ${formatDate(nextAction.due_at)}`
                : "—"}
            </dd>
          </div>
        </CardContent>
      </Card>

      {/* ACTIVIDAD COMERCIAL */}
      <div className="space-y-4">
        <p className={GROUP_LABEL_CLASS}>Actividad comercial</p>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Visitas</CardTitle>
          </CardHeader>
          <CardContent>
            <VisitFeedbackList
              items={visitFeedback.map((v) => ({
                ...v,
                label: v.property_title ?? "Propiedad",
              }))}
              emptyMessage="Sin visitas con feedback registrado todavía."
            />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Propiedades presentadas</CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sin propiedades presentadas todavía.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recommendations.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/properties/${r.property_id}`}
                      className="font-medium hover:underline"
                    >
                      {r.property?.title ?? "Propiedad"}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · {RECOMMENDATION_CHANNEL_LABELS[r.channel]} ·{" "}
                      {RECOMMENDATION_STATUS_LABELS[r.status]} ·{" "}
                      {formatEventDay(r.sent_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Registrar actividad</CardTitle>
            <Button
              render={<Link href={`/calendar/new?contactId=${contact.id}`} />}
              nativeButton={false}
              variant="ghost"
              size="sm"
            >
              + Agendar
            </Button>
          </CardHeader>
          <CardContent>
            <form
              action={logActivity.bind(null, { contactId: contact.id })}
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
                className="min-w-40 flex-1"
              />
              <Button type="submit" variant="default">
                Registrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card size="sm" id="tareas">
          <CardHeader>
            <CardTitle>Tareas</CardTitle>
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{task.title}</span>
                      <StatusBadge tone={taskPriorityTone(task.priority)}>
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </StatusBadge>
                      {task.due_at ? (
                        <span className="text-muted-foreground">
                          {formatDate(task.due_at)}
                        </span>
                      ) : null}
                    </div>
                    <form
                      action={completeTask.bind(
                        null,
                        { contactId: contact.id },
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
              action={createTask.bind(null, { contactId: contact.id })}
              className="flex flex-wrap items-end gap-2 border-t pt-4"
            >
              <Input
                name="title"
                placeholder="Nueva tarea"
                className="min-w-40 flex-1"
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
              <Button type="submit" variant="default">
                Agregar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action={addNote.bind(null, { contactId: contact.id })}
              className="space-y-2"
            >
              <Textarea
                name="body"
                placeholder="Agregar una nota..."
                required
              />
              <Button type="submit" variant="default">
                Guardar nota
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline entries={timeline} />
          </CardContent>
        </Card>
      </div>

      {/* DATOS PERSONALES */}
      {personalDataRows.length > 0 ? (
        <div className="space-y-2">
          <p className={GROUP_LABEL_CLASS}>Datos personales</p>
          <Card size="sm">
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              {personalDataRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
