"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CREATE_ITEMS = [
  { label: "Cliente", href: "/contacts/new" },
  { label: "Propiedad", href: "/properties/new" },
  { label: "Lead", href: "/leads/new" },
  { label: "Búsqueda", href: "/searches/new" },
  { label: "Captación", href: "/acquisitions/new" },
  { label: "Operación", href: "/deals/new" },
];

/**
 * Global "+ Nuevo" CTA (Bloque UI-2, spec point 27) — one primary action in
 * the header instead of each page inventing its own create button at the
 * same visual weight as everything else. Doesn't replace the per-page
 * create buttons (a property's own page still has "+ Nueva oferta" etc. in
 * context) — this is only for "create a brand new top-level record from
 * anywhere".
 */
export function QuickCreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm">
            <Plus />
            <span className="hidden sm:inline">Nuevo</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {CREATE_ITEMS.map((item) => (
          <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
