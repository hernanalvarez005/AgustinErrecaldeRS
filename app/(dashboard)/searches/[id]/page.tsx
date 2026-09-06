import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updateSearchStatus } from "@/app/(dashboard)/searches/actions";
import { buildTimeline, Timeline } from "@/components/contacts/timeline";
import { MatchScoreBadge } from "@/components/matching/match-score-badge";
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
import { createRecommendation } from "@/lib/actions/recommendations";
import { requireMembership } from "@/lib/auth/session";
import { getActivities, getNotes, getTasks } from "@/lib/data/engagement";
import { getPropertyMatchesForSearch } from "@/lib/data/matching";
import { getSearch } from "@/lib/data/searches";
import { formatBudget, formatDate } from "@/lib/format";
import {
  ACTIVITY_TYPE_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
} from "@/lib/validations/activity";
import {
  OPERATION_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/validations/property";
import {
  RECOMMENDATION_CHANNEL_LABELS,
  RECOMMENDATION_CHANNELS,
} from "@/lib/validations/recommendation";
import {
  SEARCH_OBJECTIVE_LABELS,
  SEARCH_STATUS_LABELS,
  SEARCH_STATUSES,
  SEARCH_URGENCY_LABELS,
} from "@/lib/validations/search";
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

export default async function SearchDetailPage({
  params,
}: PageProps<"/searches/[id]">) {
  const { id } = await params;
  const membership = await requireMembership();

  const search = await getSearch(id);
  if (!search) notFound();

  const [contact, notes, tasks, activities, matches] = await Promise.all([
    getContact(search.contact_id),
    getNotes({ searchId: id }),
    getTasks({ searchId: id }),
    getActivities({ searchId: id }),
    getPropertyMatchesForSearch(membership.organization.id, search),
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
            {contact
              ? `${contact.first_name} ${contact.last_name}`
              : "Búsqueda"}
          </h1>
          <Button
            render={<Link href={`/searches/${search.id}/edit`} />}
            nativeButton={false}
            variant="ghost"
            size="icon-sm"
          >
            <Pencil />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{SEARCH_STATUS_LABELS[search.status]}</Badge>
          {search.objective ? (
            <Badge variant="secondary">
              {SEARCH_OBJECTIVE_LABELS[search.objective]}
            </Badge>
          ) : null}
          {search.urgency ? (
            <span className="text-muted-foreground text-sm">
              Urgencia: {SEARCH_URGENCY_LABELS[search.urgency]}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          {OPERATION_TYPE_LABELS[search.operation_type]}
          {search.property_types.length > 0
            ? ` · ${search.property_types.map((t) => PROPERTY_TYPE_LABELS[t]).join(", ")}`
            : ""}
          {" · "}
          {formatBudget(search.min_price, search.max_price, search.currency)}
        </p>
        {search.cities.length > 0 || search.neighborhoods.length > 0 ? (
          <p className="text-muted-foreground text-sm">
            Zona: {[...search.cities, ...search.neighborhoods].join(", ")}
          </p>
        ) : null}
        {search.notes ? (
          <p className="text-muted-foreground text-sm">{search.notes}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Estado del pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={updateSearchStatus.bind(null, search.id)}
            className="flex items-end gap-2"
          >
            <Select
              name="status"
              defaultValue={search.status}
              items={SEARCH_STATUS_LABELS}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEARCH_STATUS_LABELS[s]}
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
          <CardTitle className="text-sm">Coincidencias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {matches.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin propiedades activas que coincidan por ahora.
            </p>
          ) : (
            <ul className="space-y-3">
              {matches.map((match) => (
                <li key={match.property.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/properties/${match.property.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {match.property.title}
                    </Link>
                    <MatchScoreBadge score={match.score} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {match.summary}
                  </p>
                  <form
                    action={createRecommendation.bind(
                      null,
                      match.property.id,
                      search.id,
                      search.contact_id,
                    )}
                    className="flex items-center gap-2"
                  >
                    <Select
                      name="channel"
                      defaultValue="whatsapp"
                      items={RECOMMENDATION_CHANNEL_LABELS}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECOMMENDATION_CHANNELS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {RECOMMENDATION_CHANNEL_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="submit" size="sm" variant="outline">
                      Registrar envío
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground text-xs">
            Coincidencia calculada por criterios (presupuesto, ubicación,
            ambientes, superficie, cochera) — no evalúa balcón/patio/ascensor
            porque las propiedades todavía no registran esos datos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registrar actividad</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={logActivity.bind(null, { searchId: search.id })}
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
                      { searchId: search.id },
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
            action={createTask.bind(null, { searchId: search.id })}
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
            action={addNote.bind(null, { searchId: search.id })}
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
