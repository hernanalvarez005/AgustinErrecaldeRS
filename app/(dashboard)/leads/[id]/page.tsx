import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updateLeadStatus } from "@/app/(dashboard)/leads/actions";
import { buildTimeline, Timeline } from "@/components/contacts/timeline";
import { ConvertLeadForm } from "@/components/leads/convert-lead-form";
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
import { getActivities, getNotes, getTasks } from "@/lib/data/engagement";
import { getLead } from "@/lib/data/leads";
import { getProperty } from "@/lib/data/properties";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  ACTIVITY_TYPE_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
} from "@/lib/validations/activity";
import { CONTACT_SOURCE_LABELS } from "@/lib/validations/contact";
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/validations/lead";
import { TASK_PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/validations/task";
import { createClient } from "@/lib/supabase/server";

async function getConvertedContact(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("id", contactId)
    .single();
  return data;
}

export default async function LeadDetailPage({
  params,
}: PageProps<"/leads/[id]">) {
  const { id } = await params;

  const lead = await getLead(id);
  if (!lead) notFound();

  const [property, contact, notes, tasks, activities] = await Promise.all([
    lead.property_id ? getProperty(lead.property_id) : null,
    lead.contact_id ? getConvertedContact(lead.contact_id) : null,
    getNotes({ leadId: id }),
    getTasks({ leadId: id }),
    getActivities({ leadId: id }),
  ]);

  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  const timeline = buildTimeline({ notes, activities, tasks });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {lead.first_name} {lead.last_name ?? ""}
          </h1>
          <Button
            render={<Link href={`/leads/${lead.id}/edit`} />}
            nativeButton={false}
            variant="ghost"
            size="icon-sm"
          >
            <Pencil />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{LEAD_STATUS_LABELS[lead.status]}</Badge>
          {lead.source ? (
            <Badge variant="secondary">
              {CONTACT_SOURCE_LABELS[lead.source]}
            </Badge>
          ) : null}
          <span className="text-muted-foreground text-sm">
            Ingresó {formatDateTime(lead.created_at)}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {[lead.phone, lead.email].filter(Boolean).join(" · ") ||
            "Sin datos de contacto"}
        </p>
        {property ? (
          <p className="text-sm">
            Interesado en:{" "}
            <Link
              href={`/properties/${property.id}`}
              className="underline underline-offset-2"
            >
              {property.title}
            </Link>
          </p>
        ) : null}
        {lead.message ? (
          <p className="bg-muted/30 rounded-md border p-3 text-sm whitespace-pre-wrap">
            {lead.message}
          </p>
        ) : null}
        {lead.notes ? (
          <p className="text-muted-foreground text-sm">{lead.notes}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Estado</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={updateLeadStatus.bind(null, lead.id)}
            className="flex items-end gap-2"
          >
            <Select
              name="status"
              defaultValue={lead.status}
              items={LEAD_STATUS_LABELS}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              Actualizar estado
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Conversión</CardTitle>
        </CardHeader>
        <CardContent>
          {contact ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                Convertido a{" "}
                <Link
                  href={`/contacts/${contact.id}`}
                  className="underline underline-offset-2"
                >
                  {contact.first_name} {contact.last_name}
                </Link>
              </span>
              {lead.search_id ? (
                <Button
                  render={<Link href={`/searches/${lead.search_id}`} />}
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                >
                  Ver búsqueda
                </Button>
              ) : (
                <Button
                  render={
                    <Link
                      href={`/searches/new?contactId=${contact.id}&leadId=${lead.id}`}
                    />
                  }
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                >
                  + Nueva búsqueda
                </Button>
              )}
            </div>
          ) : (
            <ConvertLeadForm lead={lead} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registrar actividad</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={logActivity.bind(null, { leadId: lead.id })}
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
                      { leadId: lead.id },
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
            action={createTask.bind(null, { leadId: lead.id })}
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
            action={addNote.bind(null, { leadId: lead.id })}
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
