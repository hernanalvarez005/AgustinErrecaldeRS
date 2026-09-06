"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { activitySchema } from "@/lib/validations/activity";
import { noteSchema } from "@/lib/validations/note";
import { taskSchema } from "@/lib/validations/task";
import type { EngagementContext } from "@/lib/data/engagement";

function revalidateContext(context: EngagementContext) {
  if (context.contactId) revalidatePath(`/contacts/${context.contactId}`);
  if (context.propertyId) revalidatePath(`/properties/${context.propertyId}`);
  if (context.acquisitionId)
    revalidatePath(`/acquisitions/${context.acquisitionId}`);
}

export async function addNote(context: EngagementContext, formData: FormData) {
  const membership = await requireMembership();
  const parsed = noteSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    console.error("Invalid input:", parsed.error.issues);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({
    organization_id: membership.organization.id,
    contact_id: context.contactId ?? null,
    property_id: context.propertyId ?? null,
    acquisition_id: context.acquisitionId ?? null,
    body: parsed.data.body,
  });
  if (error) console.error("Failed to add note:", error.message);

  revalidateContext(context);
}

export async function createTask(
  context: EngagementContext,
  formData: FormData,
) {
  const membership = await requireMembership();
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    priority: formData.get("priority") || undefined,
    dueAt: formData.get("dueAt"),
  });
  if (!parsed.success) {
    console.error("Invalid input:", parsed.error.issues);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    organization_id: membership.organization.id,
    contact_id: context.contactId ?? null,
    property_id: context.propertyId ?? null,
    acquisition_id: context.acquisitionId ?? null,
    title: parsed.data.title,
    priority: parsed.data.priority,
    due_at: parsed.data.dueAt
      ? new Date(parsed.data.dueAt).toISOString()
      : null,
  });
  if (error) console.error("Failed to create task:", error.message);

  revalidateContext(context);
}

export async function completeTask(context: EngagementContext, taskId: string) {
  await requireMembership();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) console.error("Failed to complete task:", error.message);

  revalidateContext(context);
}

export async function logActivity(
  context: EngagementContext,
  formData: FormData,
) {
  const membership = await requireMembership();
  const parsed = activitySchema.safeParse({
    type: formData.get("type"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    console.error("Invalid input:", parsed.error.issues);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    organization_id: membership.organization.id,
    contact_id: context.contactId ?? null,
    property_id: context.propertyId ?? null,
    acquisition_id: context.acquisitionId ?? null,
    type: parsed.data.type,
    description: parsed.data.description ?? null,
    status: "completed",
  });
  if (error) console.error("Failed to log activity:", error.message);

  revalidateContext(context);
}
