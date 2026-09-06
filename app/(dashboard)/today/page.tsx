import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMembership, getProfile } from "@/lib/auth/session";
import { BUSINESS_TIMEZONE } from "@/lib/date";
import {
  listCommercialAlerts,
  listOverdueTasks,
  listTasksDueToday,
  listTodayActivities,
  type TodayActivity,
  type TodayTask,
} from "@/lib/data/today";
import { formatDate, formatDateTime } from "@/lib/format";
import { ACTIVITY_TYPE_LABELS } from "@/lib/validations/activity";
import { TASK_PRIORITY_LABELS } from "@/lib/validations/task";

function LinkOrPlain({
  link,
  children,
}: {
  link: { href: string; label: string } | null;
  children: React.ReactNode;
}) {
  if (!link) return <span className="font-medium">{children}</span>;
  return (
    <Link href={link.href} className="font-medium hover:underline">
      {children}
    </Link>
  );
}

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
          <LinkOrPlain link={task.link}>{task.title}</LinkOrPlain>
          <span className="text-muted-foreground">
            {" "}
            ·{" "}
            {
              TASK_PRIORITY_LABELS[
                task.priority as keyof typeof TASK_PRIORITY_LABELS
              ]
            }
            {task.link ? ` · ${task.link.label}` : ""}
            {task.due_at ? ` · ${formatDate(task.due_at)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AgendaList({ activities }: { activities: TodayActivity[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Sin eventos agendados para hoy.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {activities.map((activity) => (
        <li key={activity.id} className="text-sm">
          <span className="text-muted-foreground">
            {formatDateTime(activity.starts_at)} ·{" "}
          </span>
          <LinkOrPlain link={activity.link}>
            {ACTIVITY_TYPE_LABELS[activity.type]}
          </LinkOrPlain>
          {activity.link ? (
            <span className="text-muted-foreground">
              {" "}
              · {activity.link.label}
            </span>
          ) : null}
          {activity.description ? (
            <p className="text-muted-foreground">{activity.description}</p>
          ) : null}
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

  const [tasksToday, overdueTasks, todayActivities, alerts] = organizationId
    ? await Promise.all([
        listTasksDueToday(organizationId),
        listOverdueTasks(organizationId),
        listTodayActivities(organizationId),
        listCommercialAlerts(organizationId),
      ])
    : [[], [], [], []];

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
            timeZone: BUSINESS_TIMEZONE,
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
          <CardContent>
            <AgendaList activities={todayActivities} />
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
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin alertas.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((alert) => (
                  <li key={alert.href} className="text-sm">
                    <Link href={alert.href} className="hover:underline">
                      {alert.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
