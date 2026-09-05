import "server-only";

import { createClient } from "@/lib/supabase/server";

export type TodayTask = {
  id: string;
  title: string;
  due_at: string | null;
  priority: string;
  contact: { id: string; first_name: string; last_name: string } | null;
};

async function withContactNames(
  tasks: Array<{
    id: string;
    title: string;
    due_at: string | null;
    priority: string;
    contact_id: string | null;
  }>,
): Promise<TodayTask[]> {
  const contactIds = [
    ...new Set(
      tasks.map((t) => t.contact_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (contactIds.length === 0) {
    return tasks.map((t) => ({ ...t, contact: null }));
  }

  const supabase = await createClient();
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .in("id", contactIds);

  if (error) {
    console.error("Failed to load contact names for tasks:", error.message);
  }

  const byId = new Map((contacts ?? []).map((c) => [c.id, c]));
  return tasks.map((t) => ({
    ...t,
    contact: t.contact_id ? (byId.get(t.contact_id) ?? null) : null,
  }));
}

/** Pending/in-progress tasks due today (or with no due date, on /today by choice? no — only ones due today). */
export async function listTasksDueToday(organizationId: string) {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_at, priority, contact_id")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "in_progress"])
    .gte("due_at", startOfDay)
    .lt("due_at", endOfDay)
    .order("due_at", { ascending: true });

  if (error) {
    console.error("Failed to load today's tasks:", error.message);
    return [];
  }
  return withContactNames(data);
}

/** Pending/in-progress tasks whose due date has already passed. */
export async function listOverdueTasks(organizationId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_at, priority, contact_id")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "in_progress"])
    .lt("due_at", startOfDay.toISOString())
    .order("due_at", { ascending: true });

  if (error) {
    console.error("Failed to load overdue tasks:", error.message);
    return [];
  }
  return withContactNames(data);
}
