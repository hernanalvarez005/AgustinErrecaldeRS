import { redirect } from "next/navigation";

import { getAuthUser, getCurrentMembership } from "@/lib/auth/session";

export default async function RootPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");

  redirect("/today");
}
