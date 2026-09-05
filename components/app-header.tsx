"use client";

import { LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/login/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function AppHeader({ displayName }: { displayName: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />

      <DropdownMenu>
        <DropdownMenuTrigger className="focus-visible:ring-ring flex items-center gap-2 rounded-full outline-none focus-visible:ring-2">
          <Avatar className="size-8">
            <AvatarFallback>{initials(displayName)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={<form action={signOut} className="w-full" />}
          >
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
