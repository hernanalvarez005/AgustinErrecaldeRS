import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  getAuthUser,
  getCurrentMembership,
  getProfile,
} from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");

  const profile = await getProfile();
  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email ||
    "Cuenta";

  return (
    <SidebarProvider>
      <AppSidebar organizationName={membership.organization.name} />
      <SidebarInset>
        <AppHeader displayName={displayName} />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
