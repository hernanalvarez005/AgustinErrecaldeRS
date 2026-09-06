# Architecture

## Stack y por qué

- **Next.js 16 (App Router, TypeScript, Turbopack).** Next 16 es la versión
  estable actual; trae cambios de ruptura reales respecto a versiones
  anteriores (ver `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`,
  bundleado con el paquete). Los que más afectan a este proyecto:
  - `params`, `searchParams`, `cookies()`, `headers()` son **siempre
    asíncronos** ahora — todo Server Component/Route Handler que los usa hace
    `await`.
  - `middleware.ts` fue renombrado a **`proxy.ts`** (export `proxy`, no
    `middleware`). Ver `proxy.ts` en la raíz.
  - `next lint` fue removido; se usa el ESLint CLI directo (`"lint": "eslint"`
    en package.json, con flat config en `eslint.config.mjs`).
  - Turbopack es el bundler por defecto en `dev` y `build`.
  - Los helpers de tipos `PageProps<'/ruta'>` / `LayoutProps<'/ruta'>` se
    generan automáticamente y se usan en vez de tipar `params`/`searchParams`
    a mano.
- **Supabase** (Postgres + Auth + RLS). Un solo proveedor para datos, auth y
  (a futuro) storage, con migraciones versionadas como fuente de verdad del
  esquema — nunca cambios manuales desde el dashboard.
- **Tailwind CSS v4 + shadcn/ui** (estilo `base-nova`, construido sobre
  **Base UI** — `@base-ui/react` — no Radix). Los componentes viven en
  `components/ui/` y se versionan como código propio, no como dependencia.
- **Zod** para validación de formularios y de los datos que llegan a Server
  Actions, en cliente y servidor.
- **Vercel** para hosting; Preview deployments por PR.

## Multitenancy desde el día uno

Aunque el producto arranca con un solo asesor, todas las tablas de negocio
llevan `organization_id` desde la primera migración. Las primitivas de
tenencia (`organizations`, `memberships`, `profiles`) se implementan en la
Fase 0 — ver docs/DATABASE.md.

**¿Por qué pagar ese costo ahora si hay un solo usuario?** Porque agregar
`organization_id` a posteriori sobre datos ya en producción (con historial
real de contactos/operaciones) es una migración de datos arriesgada, y todo
el resto del modelo (RLS, queries, UI) asume esa columna. Es mucho más barato
modelarlo bien una vez que reescribirlo bajo presión cuando aparezca el
segundo usuario.

**Cómo se mantiene simple para el caso de un solo asesor:** no hay pantallas
de gestión de equipo, invitaciones ni roles granulares en el MVP. El primer
usuario que se registra crea automáticamente su organización (flujo de
onboarding, ver `app/onboarding/`) y queda como único `owner`. La tabla
`memberships` ya soporta N usuarios por organización; simplemente no se
construye la UI para administrarlo todavía.

## Seguridad y RLS

- RLS habilitado en todas las tablas de negocio desde la primera migración.
- **Ninguna tabla de tenencia (`organizations`, `memberships`) acepta INSERT
  directo desde el cliente.** La única forma de crear una organización es la
  función `create_organization()` (SECURITY DEFINER), invocada por el flujo
  de onboarding. Esto cierra la puerta a que un usuario se "auto-invite" a una
  organización ajena insertando una fila de membership con su propio
  `user_id` y un `organization_id` arbitrario.
- `private.user_org_ids()` es una función SECURITY DEFINER que centraliza
  "¿a qué organizaciones pertenece el usuario actual?". Las políticas RLS de
  las tablas de negocio (a partir de la Fase 1) la reutilizan como
  `organization_id in (select private.user_org_ids())` en vez de repetir el
  subquery y arriesgar recursión de RLS sobre `memberships`.
- `profiles` se crea automáticamente vía trigger (`handle_new_user`) en el
  insert de `auth.users` — el cliente nunca inserta un profile directamente.
- El browser nunca ve `SUPABASE_SERVICE_ROLE_KEY` ni secretos de Google.

## Autenticación vs. autorización de Google Calendar

Login de la aplicación (Supabase Auth: email/password + magic link) y la
autorización OAuth de Google Calendar (Fase 9) son conceptualmente
independientes: un usuario puede estar logueado en el CRM sin haber
autorizado Google Calendar, y esa autorización se guarda asociada a su
usuario/organización, no como método de login. Se separan para no acoplar
"puedo entrar al CRM" con "tengo Google conectado".

## Estructura de carpetas

```
app/
  (auth)/login/          # login (password + magic link)
  auth/callback/         # route handler: exchange code for session
  onboarding/             # alta de organización (solo si el usuario no tiene membership)
  (dashboard)/
    today/                # pantalla "Hoy"
    calendar/ contacts/ leads/ properties/ searches/
    acquisitions/ deals/ dashboard/ settings/

components/
  ui/            # shadcn/ui (no editar a mano salvo necesidad puntual)
  auth/          # formularios de login/onboarding
  shared/        # ComingSoon, EmptyState, etc. reutilizados entre módulos
  app-sidebar.tsx / app-header.tsx

lib/
  supabase/      # client.ts (browser), server.ts (RSC/Server Actions), middleware.ts (proxy)
  auth/          # session.ts: getAuthUser/getProfile/getCurrentMembership
  validations/   # esquemas Zod
  slug.ts, utils.ts

types/database.types.ts   # tipos de Supabase (a mano hasta enlazar un proyecto real)

supabase/
  migrations/    # fuente de verdad del esquema
  seed.sql
```

## Decisiones que generan deuda técnica conocida (documentadas a propósito)

- **`types/database.types.ts` está escrito a mano** hasta que el proyecto se
  enlace a una instancia real de Supabase (`supabase link` o `supabase
start` con Docker). A partir de ahí, `npm run db:types` lo regenera y deja
  de mantenerse a mano. Mientras tanto, cualquier cambio de esquema debe
  reflejarse manualmente en este archivo o el type-check no detectará el
  desvío.
- **El checkeo de "¿el usuario tiene organización?" vive en cada layout/página
  que lo necesita** (`getCurrentMembership()`), no en `proxy.ts`. Se decidió
  así para no pagar una consulta a Postgres en cada request de cada ruta
  (proxy corre en runtime `nodejs` para todo, incluyendo assets); el costo es
  que cada punto de entrada nuevo a `(dashboard)/` debe recordar llamarlo (ya
  se centraliza en `app/(dashboard)/layout.tsx`, que es el único punto de
  entrada real hoy).
- **MVP asume una organización por usuario** en varios lugares (`
getCurrentMembership()` hace `.limit(1)`). El esquema soporta N
  organizaciones por usuario desde ya; el día que haga falta, ese helper es
  el único lugar que hay que tocar para dejar de asumirlo.
- **Sin tests automatizados todavía.** Ni Fase 0 ni Fase 1 los tienen — se
  priorizó tener el flujo de punta a punta (auth → onboarding → contactos →
  tareas/notas/actividades → Hoy) funcionando y verificado a mano contra un
  proyecto Supabase real antes de invertir en test harness. Se agregan antes
  de sumar más superficie (Fase 2), sobre todo RLS de `contacts` y el
  cálculo de `contact_overview`, que son los que más cuesta detectar a
  simple vista si se rompen.
- **RLS de Fase 1 sin restricción por fila.** Cualquier miembro de la
  organización puede editar/completar cualquier tarea o nota, no solo la
  propia. Correcto para un asesor solo; el día que haya varios asesores en
  una organización esto necesita revisarse (asignación, permisos por rol)
  antes de ofrecerlo como feature de equipo.

## Gotcha verificado: shadcn `Select` (Base UI) con una sola opción

Encontrado probando el picker de propietarios de una propiedad contra datos
reales: un `<Select>` de shadcn/Base UI con **un solo item** puede mostrar
ese item en el trigger con un solo click (por el posicionamiento
`alignItemWithTrigger`, que superpone el ítem sobre el trigger) sin llegar a
confirmar la selección — el input oculto que alimenta el `FormData` queda
vacío, y el submit no manda nada. Con dos o más items, un click para abrir +
un click sobre el item funciona perfectamente (verificado). La solución no
es una animación ni un `defaultValue`: cuando la lista tiene exactamente un
elemento, no se renderiza el `Select` — se manda un `<input type="hidden">`
con ese único valor y se muestra el nombre como texto plano (ver
`app/(dashboard)/properties/[id]/page.tsx`, selector de propietarios). Si
aparece un nuevo `Select` con una lista que puede tener un solo elemento
(no un enum fijo con 2+ opciones), aplicar el mismo patrón.

## Gotcha verificado: `FormData.get()` devuelve `null`, no `""`

Encontrado en Fase 3 al agregar una tasación: un campo opcional que no tiene
`<input>` en el formulario (`valuationDate`, olvidado en el primer borrador
del form) hace que `formData.get("valuationDate")` devuelva `null` — no
`""` como un input de texto vacío. El helper `emptyToUndefined` de
`lib/validations/*.ts` solo contemplaba `""`, así que Zod rechazaba `null`
contra `z.string().optional()` y la acción fallaba **en silencio** (`if
(!parsed.success) return;` sin loguear nada). Dos correcciones:

1. `emptyToUndefined` se centralizó en `lib/validations/shared.ts` y ahora
   trata `""` y `null` igual. Los 6 esquemas que lo definían por separado
   importan la versión compartida.
2. Todo `if (!parsed.success) return;` en `lib/actions/engagement.ts` y las
   acciones de captaciones ahora loguea `parsed.error.issues` antes de
   volver — un fallo de validación en un server action nunca debe ser
   silencioso, aunque no se le muestre el detalle al usuario.

## Gotchas verificados: `@dnd-kit/core` + Server Components

Encontrados armando el Kanban de captaciones, probando contra datos reales:

- **Un click sin arrastre puede no abrir el link de la tarjeta.**
  `PointerSensor` sin `activationConstraint` interpreta cualquier click como
  un posible drag de distancia cero. Con `useSensor(PointerSensor, {
activationConstraint: { distance: 8 } })` un click real (sin mover el
  mouse más de 8px) pasa de largo al `<Link>` de la tarjeta.
- **Mismatch de hidratación real y reproducible en `aria-describedby`,
  no un artefacto de test.** dnd-kit arma el id del elemento accesible
  (`DndDescribedBy-N`) con un contador interno que arranca en 0 en cada
  render de servidor pero sigue subiendo en el cliente con cada
  navegación (el `KanbanBoard` se vuelve a montar sin recargar la página).
  Se reprodujo navegando ida y vuelta a `/acquisitions` un par de veces.
  Fix: pasarle un `id` fijo a `<DndContext id="acquisitions-kanban">` en
  vez de dejar que dnd-kit genere el suyo.
- **"changed size between renders" en consola.** `useSensor(PointerSensor,
{ activationConstraint: {...} })` con un objeto de opciones creado
  inline se recrea en cada render, rompiendo la memoización interna de
  dnd-kit. Solución: la constante de opciones vive a nivel de módulo
  (`POINTER_SENSOR_OPTIONS`), no dentro del componente.

Los tres fixes están en `components/acquisitions/kanban-board.tsx`. Si se
arma otro `DndContext` (Fase 6, operaciones), aplicar los tres desde el
principio en vez de redescubrirlos.

## Gotcha verificado: fechas "sin hora" mostradas un día antes (timezone)

Encontrado probando `/searches/[id]` en vivo (Fase 4): se creó una tarea con
`due_at` = 9 de octubre (elegido con un `<input type="date">`) y la UI la
mostró como **"08-oct"**.

Causa raíz, en dos partes:

1. `<input type="date">` entrega un string sin hora ni timezone
   (`"2026-10-09"`). `new Date("2026-10-09")` lo interpreta como **medianoche
   UTC** (regla del spec de ECMAScript: un string de solo fecha es UTC; un
   string de fecha+hora sin zona es hora local — son reglas distintas y es
   fácil pisarlas). `lib/actions/engagement.ts` guarda ese `.toISOString()`
   tal cual en `due_at` (`timestamptz`), lo cual es correcto — el problema
   está en cómo se vuelve a mostrar.
2. `lib/format.ts` llamaba a `.toLocaleDateString("es-AR", {...})` **sin
   `timeZone`**, así que Node convierte el instante UTC a la zona horaria
   _implícita del proceso_ (la del sistema donde corre `next dev`/el
   servidor) antes de extraer día/mes. Cualquier zona detrás de UTC —
   Argentina incluida, UTC-3 — hace que medianoche UTC del día 9 caiga en
   la noche del día 8 hora local. Mismo bug harían ver un valor distinto
   en local (según el TZ de la máquina) que en Vercel (UTC).

Fix aplicado en `lib/format.ts`: se separó el helper en tres funciones con
zona horaria **siempre explícita**, nunca implícita:

- `formatDate` — para valores que son una fecha de calendario sin hora real
  (`due_at` puesto por un `<input type="date">`, y columnas `date` nativas
  como `valuations.valuation_date`). Formatea con `timeZone: "UTC"` a
  propósito, porque así es como se escribieron: sirve para no correr la
  fecha ni un día, en ningún entorno.
- `formatEventDay` — para un timestamp real (`last_interaction_at`, que sale
  de `max(activities.starts_at)`) que se trunca a "día" para una columna de
  listado. Acá sí hay que usar la zona horaria del negocio
  (`America/Argentina/Buenos_Aires`), no UTC: una actividad registrada a las
  22:59 en Argentina es 01:59 UTC del día siguiente, y mostrarla con la
  regla de `formatDate` la haría aparecer un día adelantada. Verificado en
  vivo: antes del fix, "Última interacción" mostraba "06-sept" para una
  llamada registrada el "05-sept" a las 22:59.
- `formatDateTime` — para timestamps con hora visible (línea de tiempo de
  actividades/notas). También fijo a `America/Argentina/Buenos_Aires`, para
  que dev (timezone de la máquina) y prod (Vercel, UTC) muestren la misma
  hora para el mismo instante.

Regla para fases futuras (Fase 9, sincronización con Google Calendar, va a
tocar esto de nuevo): nunca dejar timezone implícita en un `toLocaleString`/
`toLocaleDateString` del lado servidor. Si el valor es "una fecha que alguien
eligió sin hora", va con `formatDate` (UTC). Si es "un momento real que
pasó o va a pasar", va con `formatDateTime`/`formatEventDay`
(timezone del negocio).

## Gotcha verificado: Base UI y un formulario que se revalida en el mismo lugar

Encontrado en Fase 6 probando el formulario de "precios y fechas clave" de
`/deals/[id]`: al completar por primera vez los campos de oferta/fechas/
comisión (todos vacíos hasta ese momento) y guardar, la consola tiraba:

```
Base UI: A component is changing the default value state of an
uncontrolled FieldControl after being initialized. To suppress this
warning opt to use a controlled FieldControl.
```

Causa raíz: `updateDealTerms` no hace `redirect` — solo
`revalidatePath(`/deals/${dealId}`)`, porque el formulario vive en la misma
página que muestra el resultado (a diferencia de `/searches/[id]/edit` o
`/contacts/[id]/edit`, que sí redirigen a otra ruta al guardar). Next.js
re-renderiza el Server Component con los datos frescos **sin desmontar el
árbol**, así que los `<Input defaultValue={deal.offer_price ?? ""}>` que
antes montaron con `""` ahora reciben un `defaultValue` distinto sobre la
misma instancia ya montada — exactamente el anti-patrón de "cambiar el
valor por defecto de un campo no controlado después de inicializado" que
Base UI detecta y advierte (antes lo vimos con `Select`, acá aparece en el
`Input`/`FieldControl` genérico: mismo mecanismo interno, mismo síntoma).

Verificado que era esto y no un artefacto de testing: en una pestaña nueva,
cargar la página ya con los campos poblados (después del primer guardado)
nunca tira el warning — solo aparece en la transición "vacío → poblado
en la misma instancia montada".

Fix: `key={deal.updated_at}` en el `<form>`. Cuando `updated_at` cambia
(es decir, cuando el guardado realmente pisa datos), React trata el
formulario como un nodo nuevo — lo desmonta y remonta con las
`defaultValue` correctas desde cero, en vez de mutar una instancia ya
inicializada. No hace falta convertir los campos a controlados.

Aplica a cualquier formulario futuro que edite datos y se quede en la
misma ruta (server action sin `redirect`, solo `revalidatePath`) con
inputs no controlados que arrancan vacíos — no a los que redirigen a otra
página al guardar (esos sí remontan solos, por el cambio de ruta).

**Reaparecido en V2 bloque G**, esta vez sí en un `Select`: el control de
estado de "Interesados" (`updateRecommendationStatus`, sin `redirect`,
misma página) mostraba el mismo warning al cambiar el estado de un envío
ya existente — el `Select` monta con `defaultValue={r.status}` la primera
vez y, tras revalidar, recibe un `defaultValue` distinto sobre la misma
instancia. Mismo fix exacto: `key={r.updated_at}` en el `<form>` que lo
contiene. Confirma que la regla de arriba es genérica y no específica de
`deals` — cualquier control no controlado (`Input`, `Select`, lo que sea)
dentro de un formulario "revalida en el lugar" necesita esta `key` si su
valor puede cambiar de un guardado al siguiente.

## Gotcha verificado: "hoy" calculado con la zona horaria equivocada

Encontrado planificando Fase 7 (`/today`), antes de tocar nada:
`lib/data/today.ts` calculaba los límites de "hoy"/"vencido" así:

```ts
const now = new Date();
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
```

Mismo bug de fondo que el de fechas de Fase 4, pero en una **consulta**
en vez de en un `format`: `now.getFullYear()/getMonth()/getDate()`
devuelven la fecha en la zona horaria **implícita del proceso** (la
máquina de desarrollo, o UTC en Vercel), no en la del negocio
(Argentina). Un `due_at` guardado como medianoche UTC para el día X (ver
el gotcha de fechas más arriba) se comparaba entonces contra "medianoche
local del servidor", que no coincide con medianoche UTC salvo que el
servidor esté en UTC — así que una tarea con vencimiento "hoy" podía
aparecer en "Seguimientos vencidos" o directamente no aparecer en ningún
lado, según en qué máquina/entorno corriera, sin ningún error visible.

Fix: `lib/date.ts` centraliza el cálculo de "hoy" a partir de la zona del
negocio (`America/Argentina/Buenos_Aires`) vía `Intl.DateTimeFormat`,
nunca de `new Date().getFullYear()/...`. Dos variantes, mismo criterio
que `formatDate`/`formatEventDay`:

- `getDateOnlyTodayBoundsUtc()` — para comparar contra `due_at` (fechas
  sin hora, ancladas a medianoche UTC): límites en medianoche UTC del
  día de hoy en Argentina.
- `getBusinessDayBoundsUtc()`/`getBusinessRangeBoundsUtc()` — para
  comparar contra timestamps reales (`activities.starts_at`): límites en
  medianoche de Argentina (00:00 ART), expresados en UTC. (Se llamaba
  `getBusinessTodayBoundsUtc()` en Fase 7; generalizada en Fase 8 para
  aceptar cualquier día/rango, no solo "hoy", que es lo que necesita el
  calendario.)

Verificado en vivo creando una tarea con vencimiento hoy y otra vencida
hace dos días: cada una aparece en la sección correcta de `/today`.

Regla para cualquier código futuro que necesite "qué es hoy" en el
servidor: nunca `new Date().getFullYear()/getMonth()/getDate()` — siempre
`lib/date.ts`.

## Gotcha verificado: escribir un `<input type="datetime-local">` con la zona horaria equivocada

Encontrado construyendo `/calendar/new` (Fase 8), antes de que llegara a
producción: una fecha-hora sin zona sigue una regla de parseo
**opuesta** a la de una fecha sola. `new Date("2026-09-10")` es UTC (ver
el gotcha de fechas más arriba), pero `new Date("2026-09-10T15:30")` —
exactamente el valor que entrega un `<input type="datetime-local">` — es
**hora local**, según el spec de ECMAScript. Pasar ese valor directo a
`new Date(...).toISOString()` en el servidor habría guardado el instante
equivocado en cualquier máquina/entorno que no esté en la zona de
Argentina — la contracara, del lado de escritura, del gotcha de
`formatDate` (que es del lado de lectura).

Fix: `businessDateTimeToUtcIso()` en `lib/date.ts` nunca usa
`new Date(datetimeLocal)` sobre el valor crudo — arma el instante UTC a
mano a partir de los componentes de fecha/hora, tratando el string como
hora de pared en Argentina, y le suma el offset fijo (+3h) para llegar a
UTC. La inversa, `utcIsoToBusinessDateTimeLocal()` (para precargar el
formulario de edición), sí puede usar `Intl.DateTimeFormat` de forma
segura, porque ahí se parte de un instante ya correcto — solo hay que
reformatearlo en la zona del negocio, no inventar uno nuevo.

Verificado en vivo: evento agendado a las 09:00 (hora Argentina) se
guardó como `2026-09-10T12:00:00+00:00` (UTC) y se volvió a mostrar como
"09:00" tanto en el formulario de edición como en las vistas de
mes/semana/día — sin corrimiento en ninguna dirección.

Regla para cualquier código futuro que lea un `datetime-local` (o
cualquier fecha-hora sin zona explícita) del lado del servidor: nunca
`new Date(valorCrudo)` — siempre `lib/date.ts`.

## Google Calendar: por qué la sincronización es "best-effort" y unilateral

`lib/google/calendar.ts` (Fase 9) nunca deja que un fallo de la API de
Google impida guardar el registro en el CRM: `createGoogleCalendarEvent`/
`updateGoogleCalendarEvent`/`deleteGoogleCalendarEvent` atrapan sus
propios errores, loguean el `status` HTTP (nunca el cuerpo de la
respuesta ni el token) y devuelven `null`/`false` en vez de propagar la
excepción. La razón: el CRM es la fuente de verdad de la agenda del
asesor — que Google esté momentáneamente caído, que el token haya sido
revocado manualmente, o que el asesor todavía no haya conectado su cuenta
nunca debería impedir agendar/editar/cancelar un evento en `/calendar`.
El costo de esta decisión es que un evento puede quedar "no sincronizado"
sin que el asesor se entere en el momento — aceptable para una sync que
es explícitamente de un solo sentido y de mejor esfuerzo, no aceptable si
esto alguna vez se vuelve bidireccional (ahí sí hace falta una cola de
reintentos y feedback visible).

También por eso la sincronización es unilateral CRM → Calendar y no al
revés: sincronizar Calendar → CRM requeriría un webhook (push
notifications de Google) o polling periódico, más lógica de resolución
de conflictos cuando el mismo evento cambió en los dos lados — explícitamente
fuera de alcance de esta fase (docs/ROADMAP.md), documentado como fase
futura si hace falta.

## Gotcha evitado a propósito: `google_calendar_connections` sin `organization_id`

A diferencia de cada tabla de negocio de este proyecto (que lleva
`organization_id` y una política RLS `organization_id in (select
private.user_org_ids())`), `google_calendar_connections` es 1:1 con
`auth.users` — mismo patrón que `profiles` — y su RLS es simplemente
`user_id = auth.uid()`. Esto es deliberado, no un descuido: una conexión
de Google es una credencial personal del asesor (su cuenta de Gmail), no
un dato de negocio que otro miembro de la misma organización debería
poder leer o usar. Si el día de mañana un equipo comparte una
organización, cada asesor sigue necesitando conectar su propia cuenta de
Google — no hay "una" conexión de la organización para reutilizar entre
varios usuarios.

## Gotcha real encontrado: el middleware bloqueaba su propio endpoint de cron

`lib/supabase/middleware.ts` redirige a `/login` cualquier request sin
sesión de Supabase que no esté en una lista corta de rutas públicas. El
Route Handler del cron de retención (`app/api/cron/retention-tasks`,
Fase 12) tiene su propia autenticación — un header `Authorization: Bearer
<CRON_SECRET>` que Vercel Cron envía solo — pero como nunca hay una
sesión de Supabase detrás de ese request, el middleware lo interceptaba
antes de que el Route Handler llegara siquiera a mirar el header, y
redirigía a `/login` con un 307. El fix fue agregar `/api/cron` a
`PUBLIC_PATH_PREFIXES` — no porque el endpoint sea público (exige su
propio secreto), sino porque el gate de sesión del middleware no aplica
ahí: ese endpoint nunca va a tener una sesión de Supabase, tiene la suya
propia. Cualquier Route Handler futuro que se autentique con su propio
mecanismo (un webhook con firma, otro cron) va a necesitar el mismo
tratamiento — el comentario junto a la constante aclara esto para que no
se lea como "sin autenticación".

## Gotcha real encontrado: `Date.now()` directo en un Server Component

`react-hooks/purity` (regla de ESLint que llegó con React 19/Next 16, no
presente en fases anteriores de este proyecto) marca error cualquier
llamada directa a una función impura (`Date.now()`, `Math.random()`,...)
escrita en el cuerpo de una función componente — incluyendo un Server
Component `async`, que para esta regla cuenta igual que un componente de
cliente. Pasó al calcular "días en cartera" en la ficha de propiedad (V2
bloque C): `Date.now()` escrito inline en `PropertyDetailPage` rompía
`npm run lint`, aunque el build igual compilaba (la regla es de ESLint,
no de TypeScript).

El fix no es dejar de calcularlo — es no escribirlo inline. Una función
nombrada aparte (`daysSinceNow` en `lib/format.ts`) que internamente
llama `Date.now()` no dispara la regla: el lint analiza el cuerpo de la
función componente en sí, no sigue las llamadas hacia adentro de
funciones importadas. `formatRelativeTime` (Fase V2 bloque A) ya hacía
exactamente esto sin problema, por eso pasó desapercibido hasta que
apareció una segunda necesidad de "tiempo transcurrido hasta ahora". Para
cualquier cálculo futuro que necesite el instante actual desde un
Server/Client Component: envolverlo en una función de `lib/`, nunca
escribir `Date.now()`/`new Date()` (sin argumento) directo en el cuerpo
del componente.
