import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addOwner,
  createOffer,
  removeOwner,
} from "@/app/(dashboard)/properties/actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { AttachmentsSection } from "@/components/attachments/attachments-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { buildTimeline, Timeline } from "@/components/contacts/timeline";
import { ContactSelectField } from "@/components/contacts/contact-select-field";
import { VisitFeedbackList } from "@/components/activities/visit-feedback-list";
import { MatchScoreBadge } from "@/components/matching/match-score-badge";
import { OfferThread } from "@/components/offers/offer-thread";
import { PriceHistory } from "@/components/properties/price-history";
import { requireMembership } from "@/lib/auth/session";
import {
  addNote,
  completeTask,
  createTask,
  logActivity,
} from "@/lib/actions/engagement";
import {
  createRecommendation,
  updateRecommendationStatus,
} from "@/lib/actions/recommendations";
import { listAttachments } from "@/lib/data/attachments";
import { getActivities, getNotes, getTasks } from "@/lib/data/engagement";
import { getSearchMatchesForProperty } from "@/lib/data/matching";
import { getOffersForProperty } from "@/lib/data/offers";
import { getPropertyPriceHistory } from "@/lib/data/property-price-history";
import {
  getProperty,
  getPropertyOwners,
  listContactOptions,
} from "@/lib/data/properties";
import { getRecommendationsForProperty } from "@/lib/data/recommendations";
import { getVisitFeedbackForProperty } from "@/lib/data/visit-feedback";
import { daysSinceNow, formatDate, formatEventDay } from "@/lib/format";
import {
  propertyStatusTone,
  recommendationStatusTone,
  taskPriorityTone,
} from "@/lib/status-tone";
import {
  ACTIVITY_TYPE_LABELS,
  LOGGABLE_ACTIVITY_TYPES,
} from "@/lib/validations/activity";
import {
  OPERATION_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/validations/property";
import {
  RECOMMENDATION_CHANNEL_LABELS,
  RECOMMENDATION_CHANNELS,
  RECOMMENDATION_STATUS_LABELS,
  RECOMMENDATION_STATUSES,
} from "@/lib/validations/recommendation";
import { TASK_PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/validations/task";
import { PROPERTY_ATTACHMENT_CATEGORIES } from "@/lib/validations/attachment";

function formatPrice(price: number | null, currency: string | null) {
  if (price === null || currency === null) return null;
  return `${currency} ${price.toLocaleString("es-AR")}`;
}

export default async function PropertyDetailPage({
  params,
}: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const membership = await requireMembership();

  const property = await getProperty(id);
  if (!property) notFound();

  const [
    owners,
    contactOptions,
    notes,
    tasks,
    activities,
    matches,
    priceHistory,
    visitFeedback,
    offers,
    recommendations,
    attachments,
  ] = await Promise.all([
    getPropertyOwners(id),
    listContactOptions(membership.organization.id),
    getNotes({ propertyId: id }),
    getTasks({ propertyId: id }),
    getActivities({ propertyId: id }),
    getSearchMatchesForProperty(membership.organization.id, property),
    getPropertyPriceHistory(id),
    getVisitFeedbackForProperty(id),
    getOffersForProperty(id),
    getRecommendationsForProperty(id),
    listAttachments({ propertyId: id }),
  ]);

  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  const price = formatPrice(property.price, property.currency);
  const pricePerSquareMeter =
    property.price && property.total_area
      ? formatPrice(property.price / property.total_area, property.currency)
      : null;
  const address = [property.street, property.street_number]
    .filter(Boolean)
    .join(" ");
  const zone = [property.neighborhood, property.city]
    .filter(Boolean)
    .join(", ");
  const availableContacts = contactOptions.filter(
    (c) => !owners.some((o) => o.contact_id === c.id),
  );
  const primaryOwner = owners.find((o) => o.is_primary_contact) ?? owners[0];

  const lastCompletedActivity = activities
    .filter((a) => a.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    )[0];
  const visitsCount = activities.filter(
    (a) => a.type === "property_visit",
  ).length;
  const daysInPortfolio = daysSinceNow(property.created_at);
  const nextAction = pendingTasks
    .filter((t) => t.due_at)
    .sort(
      (a, b) =>
        new Date(a.due_at as string).getTime() -
        new Date(b.due_at as string).getTime(),
    )[0];

  const timeline = buildTimeline({ notes, activities, tasks });

  const technicalDetails = [
    { label: "Dormitorios", value: property.bedrooms },
    { label: "Baños", value: property.bathrooms },
    { label: "Cocheras", value: property.garage_spaces },
    { label: "Precio/m²", value: pricePerSquareMeter },
    {
      label: "Superficie total",
      value: property.total_area ? `${property.total_area} m²` : null,
    },
    {
      label: "Superficie cubierta",
      value: property.covered_area ? `${property.covered_area} m²` : null,
    },
    {
      label: "Superficie descubierta",
      value: property.uncovered_area ? `${property.uncovered_area} m²` : null,
    },
    {
      label: "Terreno",
      value: property.lot_area ? `${property.lot_area} m²` : null,
    },
    {
      label: "Antigüedad",
      value:
        property.age_years !== null
          ? `${property.age_years} ${property.age_years === 1 ? "año" : "años"}`
          : null,
    },
    {
      label: "Expensas",
      value: property.expenses
        ? `$ ${property.expenses.toLocaleString("es-AR")}`
        : null,
    },
  ].filter((row) => row.value !== null && row.value !== undefined);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {property.title}
            </h1>
            <Button
              render={<Link href={`/properties/${property.id}/edit`} />}
              nativeButton={false}
              variant="ghost"
              size="icon-sm"
            >
              <Pencil />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary">
              {PROPERTY_TYPE_LABELS[property.property_type]}
            </Badge>
            <Badge variant="secondary">
              {OPERATION_TYPE_LABELS[property.operation_type]}
            </Badge>
            <StatusBadge tone={propertyStatusTone(property.status)}>
              {PROPERTY_STATUS_LABELS[property.status]}
            </StatusBadge>
          </div>
          {price ? (
            <p className="text-xl font-semibold">{price}</p>
          ) : (
            <p className="text-muted-foreground text-sm">Sin precio cargado</p>
          )}
          <p className="text-muted-foreground text-sm">
            {[address, zone].filter(Boolean).join(" · ") ||
              "Sin dirección cargada"}
          </p>
          <p className="text-muted-foreground text-xs">
            {primaryOwner ? (
              <Link
                href={`/contacts/${primaryOwner.contact_id}`}
                className="hover:underline"
              >
                {primaryOwner.contact.first_name}{" "}
                {primaryOwner.contact.last_name}
              </Link>
            ) : (
              "Sin propietario"
            )}
            {" · Captada el "}
            {formatDate(property.created_at)}
            {` · ${daysInPortfolio} ${daysInPortfolio === 1 ? "día" : "días"} en cartera`}
            {lastCompletedActivity
              ? ` · Última actividad: ${formatEventDay(lastCompletedActivity.starts_at)}`
              : ""}
          </p>
        </div>
        <Button
          render={<Link href={`/calendar/new?propertyId=${property.id}`} />}
          nativeButton={false}
          size="sm"
        >
          Agendar visita
        </Button>
      </div>

      <Tabs defaultValue="resumen">
        {/* V2.2 Bloque 9: six triggers no longer fit a 375px viewport (this
            list was five wide, still tight, until "Documentación" pushed it
            over) — TabsList is `w-fit`/no-wrap by design, so without this
            wrapper the overflow bubbles all the way up to the page body
            (verified: document.documentElement.scrollWidth > clientWidth).
            Same "scroll inside its own container" fix already used for wide
            tables, not a change to the shared Tabs component. */}
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="interesados">Interesados</TabsTrigger>
            <TabsTrigger value="visitas">Visitas</TabsTrigger>
            <TabsTrigger value="ofertas">Ofertas</TabsTrigger>
            <TabsTrigger value="actividad">Actividad</TabsTrigger>
            <TabsTrigger value="documentacion">Documentación</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumen" className="space-y-6 pt-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Propietarios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {owners.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Sin propietarios asociados.
                </p>
              ) : (
                <ul className="space-y-2">
                  {owners.map((owner) => (
                    <li
                      key={owner.contact_id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div>
                        <Link
                          href={`/contacts/${owner.contact_id}`}
                          className="font-medium hover:underline"
                        >
                          {owner.contact.first_name} {owner.contact.last_name}
                        </Link>
                        <span className="text-muted-foreground">
                          {owner.is_primary_contact ? " · Principal" : ""}
                          {owner.ownership_percentage
                            ? ` · ${owner.ownership_percentage}%`
                            : ""}
                        </span>
                      </div>
                      <form
                        action={removeOwner.bind(
                          null,
                          property.id,
                          owner.contact_id,
                        )}
                      >
                        <Button type="submit" size="icon-sm" variant="ghost">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              {availableContacts.length > 0 ? (
                <form
                  action={addOwner.bind(null, property.id)}
                  className="flex flex-wrap items-end gap-2 border-t pt-4"
                >
                  <ContactSelectField
                    name="contactId"
                    contacts={availableContacts}
                    className="w-48"
                  />
                  <Input
                    name="ownershipPercentage"
                    type="number"
                    step="0.01"
                    placeholder="% (opcional)"
                    className="w-32"
                  />
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name="isPrimaryContact"
                      className="border-input size-4 rounded"
                    />
                    Principal
                  </label>
                  <Button type="submit" variant="default">
                    Agregar propietario
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Rendimiento</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Días en cartera</dt>
                <dd className="text-lg font-medium">{daysInPortfolio}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Interesados</dt>
                <dd className="text-lg font-medium">
                  {recommendations.length}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Visitas</dt>
                <dd className="text-lg font-medium">{visitsCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ofertas</dt>
                <dd className="text-lg font-medium">{offers.length}</dd>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="pt-6 text-sm">
              <dt className="text-muted-foreground">Próxima acción</dt>
              <dd className="border-primary/30 border-l-2 pl-3 font-medium">
                {nextAction
                  ? `${nextAction.title} · ${formatDate(nextAction.due_at)}`
                  : "—"}
              </dd>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Coincidencias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {matches.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Sin búsquedas activas que coincidan por ahora.
                </p>
              ) : (
                <ul className="space-y-3">
                  {matches.map((match) => (
                    <li key={match.search.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/searches/${match.search.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {match.search.contact_first_name}{" "}
                          {match.search.contact_last_name}
                        </Link>
                        <MatchScoreBadge score={match.score} />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {match.summary}
                      </p>
                      <form
                        action={createRecommendation.bind(
                          null,
                          property.id,
                          match.search.id,
                          match.search.contact_id,
                        )}
                        className="flex items-center gap-2"
                      >
                        <Select
                          name="channel"
                          defaultValue="whatsapp"
                          items={RECOMMENDATION_CHANNEL_LABELS}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECOMMENDATION_CHANNELS.map((c) => (
                              <SelectItem key={c} value={c}>
                                {RECOMMENDATION_CHANNEL_LABELS[c]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="submit" size="sm" variant="default">
                          Registrar envío
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground text-xs">
                Coincidencia calculada por criterios (presupuesto, ubicación,
                ambientes, superficie, cochera) — no evalúa
                balcón/patio/ascensor porque esta propiedad todavía no registra
                esos datos.
              </p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Historial de precios</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceHistory entries={priceHistory} />
            </CardContent>
          </Card>

          {technicalDetails.length > 0 ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Información técnica</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {technicalDetails.map((row) => (
                  <div key={row.label}>
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="interesados" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Interesados</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Sin envíos registrados todavía — usá &quot;Registrar
                  envío&quot; desde Coincidencias, en Resumen, cuando le
                  presentes esta propiedad a un cliente.
                </p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {recommendations.map((r) => (
                    <li key={r.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/contacts/${r.contact_id}`}
                          className="font-medium hover:underline"
                        >
                          {r.contact
                            ? `${r.contact.first_name} ${r.contact.last_name}`
                            : "Contacto"}
                        </Link>
                        <StatusBadge tone={recommendationStatusTone(r.status)}>
                          {RECOMMENDATION_STATUS_LABELS[r.status]}
                        </StatusBadge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {RECOMMENDATION_CHANNEL_LABELS[r.channel]} ·{" "}
                        {formatEventDay(r.sent_at)}
                      </p>
                      {r.notes ? (
                        <p className="text-muted-foreground">{r.notes}</p>
                      ) : null}
                      <form
                        key={r.updated_at}
                        action={updateRecommendationStatus.bind(
                          null,
                          r.id,
                          property.id,
                        )}
                        className="mt-2 flex items-center gap-2"
                      >
                        <Select
                          name="status"
                          defaultValue={r.status}
                          items={RECOMMENDATION_STATUS_LABELS}
                        >
                          <SelectTrigger className="h-7 w-40 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECOMMENDATION_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {RECOMMENDATION_STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="submit" size="sm" variant="ghost">
                          Actualizar
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visitas" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Visitas</CardTitle>
            </CardHeader>
            <CardContent>
              <VisitFeedbackList
                items={visitFeedback.map((v) => ({
                  ...v,
                  label: v.contact
                    ? `${v.contact.first_name} ${v.contact.last_name}`
                    : "Visitante",
                }))}
                emptyMessage="Sin visitas con feedback registrado todavía."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ofertas" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ofertas</CardTitle>
            </CardHeader>
            <CardContent>
              <OfferThread propertyId={property.id} offers={offers} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registrar oferta</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={createOffer.bind(null, property.id)}
                className="flex flex-wrap items-end gap-2"
              >
                <ContactSelectField
                  name="contactId"
                  contacts={contactOptions}
                  className="w-48"
                />
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="Monto"
                  required
                  className="w-32"
                />
                <Select
                  name="currency"
                  defaultValue="USD"
                  items={{ ARS: "ARS", USD: "USD" }}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  name="expirationDate"
                  type="date"
                  className="w-40"
                  placeholder="Vencimiento"
                />
                <Input
                  name="conditions"
                  placeholder="Condiciones (opcional)"
                  className="min-w-40 flex-1"
                />
                <Textarea
                  name="notes"
                  placeholder="Notas (opcional)"
                  className="w-full"
                />
                <Button type="submit" variant="default">
                  Registrar oferta
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actividad" className="space-y-6 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Registrar actividad</CardTitle>
              <Button
                render={
                  <Link href={`/calendar/new?propertyId=${property.id}`} />
                }
                nativeButton={false}
                variant="ghost"
                size="sm"
              >
                + Agendar
              </Button>
            </CardHeader>
            <CardContent>
              <form
                action={logActivity.bind(null, { propertyId: property.id })}
                className="flex flex-wrap items-end gap-2"
              >
                <Select
                  name="type"
                  defaultValue={LOGGABLE_ACTIVITY_TYPES[0]}
                  items={Object.fromEntries(
                    LOGGABLE_ACTIVITY_TYPES.map((type) => [
                      type,
                      ACTIVITY_TYPE_LABELS[type],
                    ]),
                  )}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGGABLE_ACTIVITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {ACTIVITY_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  name="description"
                  placeholder="Detalle (opcional)"
                  className="min-w-40 flex-1"
                />
                <Button type="submit" variant="default">
                  Registrar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tareas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingTasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Sin tareas pendientes.
                </p>
              ) : (
                <ul className="space-y-2">
                  {pendingTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{task.title}</span>
                        <StatusBadge tone={taskPriorityTone(task.priority)}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </StatusBadge>
                        {task.due_at ? (
                          <span className="text-muted-foreground">
                            {formatDate(task.due_at)}
                          </span>
                        ) : null}
                      </div>
                      <form
                        action={completeTask.bind(
                          null,
                          { propertyId: property.id },
                          task.id,
                        )}
                      >
                        <Button type="submit" size="sm" variant="ghost">
                          Completar
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form
                action={createTask.bind(null, { propertyId: property.id })}
                className="flex flex-wrap items-end gap-2 border-t pt-4"
              >
                <Input
                  name="title"
                  placeholder="Nueva tarea"
                  className="min-w-40 flex-1"
                  required
                />
                <Select
                  name="priority"
                  defaultValue="medium"
                  items={TASK_PRIORITY_LABELS}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {TASK_PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input name="dueAt" type="date" className="w-40" />
                <Button type="submit" variant="default">
                  Agregar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                action={addNote.bind(null, { propertyId: property.id })}
                className="space-y-2"
              >
                <Textarea
                  name="body"
                  placeholder="Agregar una nota..."
                  required
                />
                <Button type="submit" variant="default">
                  Guardar nota
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline entries={timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentacion" className="pt-4">
          <Card>
            <CardContent>
              <AttachmentsSection
                attachments={attachments}
                entityRef={{ propertyId: property.id }}
                organizationId={membership.organization.id}
                categories={PROPERTY_ATTACHMENT_CATEGORIES}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
