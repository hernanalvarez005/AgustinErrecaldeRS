import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMembership, getProfile } from "@/lib/auth/session";
import {
  listOverdueTasks,
  listTasksDueToday,
  type TodayTask,
} from "@/lib/data/today";
import { formatDate } from "@/lib/format";
import { TASK_PRIORITY_LABELS } from "@/lib/validations/task";

function TaskList({
  tasks,
  emptyMessage,
}: {
  tasks: TodayTask[];
  emptyMessage: string;
}) {
  if (tasks.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }
  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li key={task.id} className="text-sm">
          <Link
            href={task.contact ? `/contacts/${task.contact.id}` : "#"}
            className="font-medium hover:underline"
          >
            {task.title}
          </Link>
          <span className="text-muted-foreground">
            {" "}
            ·{" "}
            {
              TASK_PRIORITY_LABELS[
                task.priority as keyof typeof TASK_PRIORITY_LABELS
              ]
            }
            {task.contact
              ? ` · ${task.contact.first_name} ${task.contact.last_name}`
              : ""}
            {task.due_at ? ` · ${formatDate(task.due_at)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function TodayPage() {
  const [profile, membership] = await Promise.all([
    getProfile(),
    getCurrentMembership(),
  ]);
  const firstName = profile?.first_name || "de nuevo";
  const organizationId = membership?.organization.id;

  const [tasksToday, overdueTasks] = organizationId
    ? await Promise.all([
        listTasksDueToday(organizationId),
        listOverdueTasks(organizationId),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Buenos días, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm">
          {membership?.organization.name} ·{" "}
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Agenda de hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Todavía no hay eventos. La agenda se implementa en la Fase 8.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Tareas para hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskList tasks={tasksToday} emptyMessage="Sin tareas para hoy." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Seguimientos vencidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={overdueTasks}
              emptyMessage="Sin seguimientos vencidos."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Alertas comerciales
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Sin datos todavía.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
