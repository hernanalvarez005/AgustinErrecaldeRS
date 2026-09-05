import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** The current authenticated Supabase user, or null if there's no session. */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The current user's app-level profile row. */
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone, avatar_url")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Failed to load profile:", error.message);
    return null;
  }

  return data;
}

/**
 * The current user's organization membership. MVP assumes one organization
 * per user, so this returns the first one found.
 */
export async function getCurrentMembership() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("Failed to load membership:", membershipError.message);
    return null;
  }
  if (!membership) return null;

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug, currency, timezone, main_area")
    .eq("id", membership.organization_id)
    .single();

  if (orgError || !organization) {
    if (orgError)
      console.error("Failed to load organization:", orgError.message);
    return null;
  }

  return { role: membership.role, organization };
}

/**
 * Same as getCurrentMembership(), but redirects instead of returning null.
 * Use this from Server Actions (which render nothing and can't rely on the
 * (dashboard) layout's guard) that need the current organization.
 */
export async function requireMembership() {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/onboarding");
  }
  return membership;
}
