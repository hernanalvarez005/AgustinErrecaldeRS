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
import { listProperties } from "@/lib/data/properties";
import {
  OPERATION_TYPE_LABELS,
  OPERATION_TYPES,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  PROPERTY_TYPE_LABELS,
} from "@/lib/validations/property";
import type { OperationType, PropertyStatus } from "@/types/database.types";

function formatPrice(price: number | null, currency: string | null) {
  if (price === null || currency === null) return "—";
  return `${currency} ${price.toLocaleString("es-AR")}`;
}

export default async function PropertiesPage({
  searchParams,
}: PageProps<"/properties">) {
  const params = await searchParams;
  const membership = await requireMembership();

  const q = typeof params.q === "string" ? params.q : undefined;
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const status = PROPERTY_STATUSES.includes(statusParam as PropertyStatus)
    ? (statusParam as PropertyStatus)
    : undefined;
  const operationParam =
    typeof params.operation === "string" ? params.operation : undefined;
  const operationType = OPERATION_TYPES.includes(
    operationParam as OperationType,
  )
    ? (operationParam as OperationType)
    : undefined;

  const properties = await listProperties({
    organizationId: membership.organization.id,
    search: q,
    status,
    operationType,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Propiedades</h1>
          <p className="text-muted-foreground text-sm">
            {properties.length}{" "}
            {properties.length === 1 ? "propiedad" : "propiedades"}
          </p>
        </div>
        <Button render={<Link href="/properties/new" />} nativeButton={false}>
          <Plus />
          Propiedad
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" action="/properties">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar por título, ciudad o barrio..."
          className="max-w-xs"
        />
        <Select
          name="operation"
          defaultValue={operationType ?? "all"}
          items={{ all: "Todas las operaciones", ...OPERATION_TYPE_LABELS }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las operaciones</SelectItem>
            {OPERATION_TYPES.map((o) => (
              <SelectItem key={o} value={o}>
                {OPERATION_TYPE_LABELS[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          name="status"
          defaultValue={status ?? "all"}
          items={{ all: "Todos los estados", ...PROPERTY_STATUS_LABELS }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {PROPERTY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PROPERTY_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {properties.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">Todavía no tenés propiedades.</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Creá tu primera propiedad para empezar a registrar propietarios,
            visitas y operaciones.
          </p>
          <Button render={<Link href="/properties/new" />} nativeButton={false}>
            <Plus />
            Nueva propiedad
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Propietario</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/properties/${property.id}`}
                      className="hover:underline"
                    >
                      {property.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {PROPERTY_TYPE_LABELS[property.property_type]} ·{" "}
                    {OPERATION_TYPE_LABELS[property.operation_type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {[property.neighborhood, property.city]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatPrice(property.price, property.currency)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {property.primary_owner_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {PROPERTY_STATUS_LABELS[property.status]}
                    </Badge>
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
