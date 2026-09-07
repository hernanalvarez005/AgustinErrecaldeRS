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
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch } from "@/lib/actions/search";

const NAV_ITEMS = [
  { label: "Hoy", href: "/today", icon: Home },
  { label: "Agenda", href: "/calendar", icon: CalendarDays },
  { label: "Clientes", href: "/contacts", icon: Users },
  { label: "Leads", href: "/leads", icon: Inbox },
  { label: "Propiedades", href: "/properties", icon: Building2 },
  { label: "Búsquedas", href: "/searches", icon: Search },
  { label: "Captaciones", href: "/acquisitions", icon: KanbanSquare },
  { label: "Operaciones", href: "/deals", icon: Wallet },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Configuración", href: "/settings", icon: Settings },
];

const CREATE_ITEMS = [
  { label: "Nuevo cliente", href: "/contacts/new" },
  { label: "Nueva propiedad", href: "/properties/new" },
  { label: "Nuevo lead", href: "/leads/new" },
  { label: "Nueva búsqueda", href: "/searches/new" },
  { label: "Nueva captación", href: "/acquisitions/new" },
  { label: "Nueva operación", href: "/deals/new" },
];

type SearchResults = Awaited<ReturnType<typeof globalSearch>>;

/**
 * Global search / command palette (⌘K), Bloque UI-2. Self-contained: owns
 * the header search trigger, the keyboard shortcut, and the dialog itself,
 * so mounting <CommandPalette /> once in the header is enough — no shared
 * state to prop-drill.
 *
 * `shouldFilter={false}` on <Command> because results mix client-side
 * static items (nav/create, filtered here by simple substring match) with
 * server-side search results (already filtered by lib/actions/search.ts) —
 * cmdk's built-in fuzzy filter can't reason about the async group.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    contacts: [],
    properties: [],
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    // Below the 2-char minimum there's nothing to fetch — the render below
    // already gates on `term.length >= 2` before showing `results`, so
    // stale results just sit unused rather than needing a reset here (which
    // would call setState synchronously in the effect body).
    if (query.trim().length < 2) return;

    const timeout = setTimeout(() => {
      startTransition(async () => {
        setResults(await globalSearch(query));
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const term = query.trim().toLowerCase();
  const filteredNav = term
    ? NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(term))
    : NAV_ITEMS;
  const filteredCreate = term
    ? CREATE_ITEMS.filter((item) => item.label.toLowerCase().includes(term))
    : CREATE_ITEMS;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">
          Buscar clientes, propiedades...
        </span>
        <kbd className="bg-muted ml-auto hidden shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Buscar"
        description="Buscar clientes, propiedades, o navegar a una sección"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar clientes, propiedades..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {term.length >= 2 &&
            !isPending &&
            results.contacts.length === 0 &&
            results.properties.length === 0 &&
            filteredNav.length === 0 &&
            filteredCreate.length === 0 ? (
              <CommandEmpty>Sin resultados.</CommandEmpty>
            ) : null}

            {term.length >= 2 && results.contacts.length > 0 ? (
              <CommandGroup heading="Clientes">
                {results.contacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={`contact-${contact.id}`}
                    onSelect={() => go(`/contacts/${contact.id}`)}
                  >
                    <Users />
                    {contact.first_name} {contact.last_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {term.length >= 2 && results.properties.length > 0 ? (
              <CommandGroup heading="Propiedades">
                {results.properties.map((property) => (
                  <CommandItem
                    key={property.id}
                    value={`property-${property.id}`}
                    onSelect={() => go(`/properties/${property.id}`)}
                  >
                    <Building2 />
                    {property.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {filteredNav.length > 0 ? (
              <CommandGroup heading="Ir a">
                {filteredNav.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`nav-${item.href}`}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {filteredCreate.length > 0 ? (
              <CommandGroup heading="Crear">
                {filteredCreate.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`create-${item.href}`}
                    onSelect={() => go(item.href)}
                  >
                    <UserPlus />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
