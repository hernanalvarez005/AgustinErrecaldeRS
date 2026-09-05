"use client";

import {
  Building2,
  CalendarDays,
  Home,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_SECTIONS: Array<{
  label?: string;
  items: Array<{ title: string; href: string; icon: typeof Home }>;
}> = [
  {
    items: [
      { title: "Hoy", href: "/today", icon: Home },
      { title: "Agenda", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Clientes",
    items: [
      { title: "Clientes", href: "/contacts", icon: Users },
      { title: "Leads", href: "/leads", icon: Inbox },
    ],
  },
  {
    label: "Inventario",
    items: [
      { title: "Propiedades", href: "/properties", icon: Building2 },
      { title: "Búsquedas", href: "/searches", icon: Search },
      { title: "Captaciones", href: "/acquisitions", icon: KanbanSquare },
      { title: "Operaciones", href: "/deals", icon: Wallet },
    ],
  },
  {
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
];

export function AppSidebar({ organizationName }: { organizationName: string }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        <span className="truncate text-sm font-semibold">
          {organizationName}
        </span>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section, index) => (
          <SidebarGroup key={section.label ?? index}>
            {section.label ? (
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname.startsWith(item.href)}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={pathname.startsWith("/settings")}
              tooltip="Configuración"
            >
              <Settings />
              <span>Configuración</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
