import Link from "next/link";

import { completeTask, rescheduleTask } from "@/lib/actions/engagement";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentMembership, getProfile } from "@/lib/auth/session";
import { BUSINESS_TIMEZONE } from "@/lib/date";
import {
  listCommercialAlerts,
  listDealsNeedingAttentionForToday,
  listOverdueTasks,
  listTasksDueToday,
  listTodayActivities,
  listUnansweredLeadsForToday,
  type TodayActivity,
  type TodayDeal,
  type TodayLead,
  type TodayTask,
} from "@/lib/data/today";
import { formatDate, formatRelativeTime, formatTime } from "@/lib/format";
import type { EngagementContext } from "@/lib/data/engagement";
import { dealStatusTone, taskPriorityTone } from "@/lib/status-tone";
import { ACTIVITY_TYPE_LABELS } from "@/lib/validations/activity";
import { CONTACT_SOURCE_LABELS } from "@/lib/validations/contact";
import { DEAL_STATUS_LABELS } from "@/lib/validations/deal";
import { TASK_PRIORITY_LABELS } from "@/lib/validations/task";
import type { TaskPriority } from "@/types/database.types";

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

function TaskRow({ task }: { task: TodayTask }) {
  const context: EngagementContext = {
    contactId: task.contact_id ?? undefined,
    propertyId: task.property_id ?? undefined,
    acquisitionId: task.acquisition_id ?? undefined,
    searchId: task.search_id ?? undefined,
    leadId: task.lead_id ?? undefined,
    dealId: task.deal_id ?? undefined,
  };

  const priority = task.priority as TaskPriority;

  return (
    <li className="space-y-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <LinkOrPlain link={task.link}>{task.title}</LinkOrPlain>
        <StatusBadge tone={taskPriorityTone(priority)}>
          {TASK_PRIORITY_LABELS[priority]}
        </StatusBadge>
      </div>
      {task.link || task.due_at ? (
        <p className="text-muted-foreground">
          {task.link ? task.link.label : null}
          {task.link && task.due_at ? " · " : null}
          {task.due_at ? formatDate(task.due_at) : null}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <form action={completeTask.bind(null, context, task.id)}>
          <Button type="submit" size="sm" variant="ghost">
            Completar
          </Button>
        </form>
        <form
          action={rescheduleTask.bind(null, context, task.id)}
          className="flex items-center gap-1"
        >
          <Input name="newDueDate" type="date" className="h-7 w-32 text-xs" />
          <Button type="submit" size="sm" variant="ghost">
            Reprogramar
          </Button>
        </form>
        {task.whatsappHref ? (
          <a
            href={task.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground text-sm hover:underline"
          >
            WhatsApp
          </a>
        ) : null}
      </div>
    </li>
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
    <ul className="space-y-4">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
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
    <ul className="space-y-3">
      {activities.map((activity) => (
        <li key={activity.id} className="flex gap-3 text-sm">
          <span className="text-muted-foreground w-11 shrink-0 pt-0.5 font-medium tabular-nums">
            {formatTime(activity.starts_at)}
          </span>
          <div className="min-w-0">
            <LinkOrPlain link={activity.link}>
              {ACTIVITY_TYPE_LABELS[activity.type]}
            </LinkOrPlain>
            {activity.link ? (
              <p className="text-muted-foreground">{activity.link.label}</p>
            ) : null}
            {activity.description ? (
              <p className="text-muted-foreground">{activity.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function LeadsList({ leads }: { leads: TodayLead[] }) {
  if (leads.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Sin leads nuevos sin responder.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {leads.map((lead) => (
        <li key={lead.id} className="text-sm">
          <Link
            href={`/leads/${lead.id}`}
            className="font-medium hover:underline"
          >
            {lead.name}
          </Link>
          <span className="text-muted-foreground">
            {" "}
            · {lead.source
              ? CONTACT_SOURCE_LABELS[lead.source]
              : "Sin origen"}{" "}
            · {formatRelativeTime(lead.created_at)}
          </span>
          {lead.property_title ? (
            <p className="text-muted-foreground">
              Consultó: {lead.property_title}
            </p>
          ) : null}
          {lead.message ? (
            <p className="text-muted-foreground truncate">{lead.message}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DealsList({ deals }: { deals: TodayDeal[] }) {
  if (deals.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Sin operaciones que requieran atención hoy.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {deals.map((deal) => (
        <li key={deal.id} className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/deals/${deal.id}`}
              className="font-medium hover:underline"
            >
              {deal.property_title ?? "Operación"}
            </Link>
            <StatusBadge tone={dealStatusTone(deal.status)}>
              {DEAL_STATUS_LABELS[deal.status]}
            </StatusBadge>
          </div>
          {deal.next_action_at ? (
            <p className="text-muted-foreground">
              Próxima acción: {formatDate(deal.next_action_at)}
            </p>
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

  const [
    tasksToday,
    overdueTasks,
    todayActivities,
    alerts,
    unansweredLeads,
    dealsNeedingAttention,
  ] = organizationId
    ? await Promise.all([
        listTasksDueToday(organizationId),
        listOverdueTasks(organizationId),
        listTodayActivities(organizationId),
        listCommercialAlerts(organizationId),
        listUnansweredLeadsForToday(organizationId),
        listDealsNeedingAttentionForToday(organizationId),
      ])
    : [[], [], [], [], [], []];

  // "Requieren tu atención" (V2 bloque A): seguimientos vencidos first (most
  // urgent, and the one alert with no dedicated route — it links to the
  // "Seguimientos vencidos" card further down this same page) followed by
  // the DB-computed alerts (leads sin responder, pipelines sin próxima
  // acción). Composed here instead of inside listCommercialAlerts to avoid
  // querying overdue tasks twice — the card below already needs the list,
  // not just the count.
  const attentionItems: {
    href: string;
    label: string;
    tone: "danger" | "warning";
  }[] = [
    ...(overdueTasks.length > 0
      ? [
          {
            href: "#seguimientos-vencidos",
            label:
              overdueTasks.length === 1
                ? "1 seguimiento vencido"
                : `${overdueTasks.length} seguimientos vencidos`,
            // "Vencido" ya pasó su fecha — danger, no solo "requiere
            // atención" (spec: warning es para "próximo a vencer", danger
            // para "vencido").
            tone: "danger" as const,
          },
        ]
      : []),
    ...alerts.map((a) => ({
      href: a.href,
      label: a.label,
      tone: "warning" as const,
    })),
  ];

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

      <Card>
        <CardHeader>
          <CardTitle>Requieren tu atención</CardTitle>
        </CardHeader>
        <CardContent>
          {attentionItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Todo al día — sin pendientes urgentes.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {attentionItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:opacity-80">
                    <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Agenda de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <AgendaList activities={todayActivities} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Tareas para hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskList tasks={tasksToday} emptyMessage="Sin tareas para hoy." />
          </CardContent>
        </Card>
        <Card size="sm" id="seguimientos-vencidos">
          <CardHeader>
            <CardTitle>Seguimientos vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={overdueTasks}
              emptyMessage="Sin seguimientos vencidos."
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Leads pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadsList leads={unansweredLeads} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Operaciones activas</CardTitle>
          </CardHeader>
          <CardContent>
            <DealsList deals={dealsNeedingAttention} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
