import { Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth/session";
import { listContacts } from "@/lib/data/contacts";
import { formatDate } from "@/lib/format";
import { CONTACT_ROLE_LABELS, CONTACT_ROLES } from "@/lib/validations/contact";
import type { ContactRole } from "@/types/database.types";

export default async function ContactsPage({
  searchParams,
}: PageProps<"/contacts">) {
  const params = await searchParams;
  const membership = await requireMembership();

  const q = typeof params.q === "string" ? params.q : undefined;
  const roleParam = typeof params.role === "string" ? params.role : undefined;
  const role = CONTACT_ROLES.includes(roleParam as ContactRole)
    ? (roleParam as ContactRole)
    : undefined;

  const contacts = await listContacts({
    organizationId: membership.organization.id,
    search: q,
    role,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"}
          </p>
        </div>
        <Button render={<Link href="/contacts/new" />} nativeButton={false}>
          <Plus />
          Contacto
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" action="/contacts">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, teléfono o email..."
          className="max-w-xs"
        />
        <Select
          name="role"
          defaultValue={role ?? "all"}
          items={{ all: "Todos los roles", ...CONTACT_ROLE_LABELS }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {CONTACT_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {CONTACT_ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {contacts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">Todavía no tenés contactos.</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Creá tu primer contacto para empezar a registrar búsquedas, tareas y
            actividades.
          </p>
          <Button render={<Link href="/contacts/new" />} nativeButton={false}>
            <Plus />
            Nuevo contacto
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Última interacción</TableHead>
                <TableHead>Próxima acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="hover:underline"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(contact.roles ?? []).map((r) => (
                        <Badge key={r} variant="secondary">
                          {CONTACT_ROLE_LABELS[r]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {contact.phone || contact.email || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(contact.last_interaction_at) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(contact.next_action_at) ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
