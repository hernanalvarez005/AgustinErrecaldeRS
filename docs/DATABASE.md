# Database

PostgreSQL vía Supabase. Migraciones versionadas en `supabase/migrations/`,
aplicadas en orden por timestamp. Nunca se edita el esquema a mano desde el
dashboard de Supabase.

Convenciones usadas en todas las tablas de negocio:

- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null references organizations(id) on delete cascade`
  (multitenancy — ver docs/ARCHITECTURE.md)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` + trigger `set_updated_at()`
  cuando la fila es editable
- Dinero: `numeric`, nunca `float`/`double`; siempre junto a una columna de
  moneda (`currency text check (currency in ('ARS','USD'))`).
- Estados: `text` + `check` constraint (enum-like), no `enum` de Postgres —
  más simple de migrar (agregar un valor es un `alter table ... drop
constraint / add constraint`, no un `alter type`).
- Soft delete para entidades con historial relevante: `archived_at
timestamptz` en vez de borrado físico.

## Implementado (Fase 0)

### `organizations`

| columna                | tipo                                                   | notas                                       |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------- |
| id                     | uuid pk                                                |                                             |
| name                   | text not null                                          | nombre comercial                            |
| slug                   | text unique not null                                   | `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` |
| currency               | text not null default 'ARS'                            | `check in ('ARS','USD')`                    |
| timezone               | text not null default 'America/Argentina/Buenos_Aires' |                                             |
| main_area              | text                                                   | zona principal de trabajo (onboarding)      |
| created_at, updated_at | timestamptz                                            |                                             |

RLS: SELECT para miembros; UPDATE para `owner`/`admin`. Sin INSERT/DELETE
directo — solo vía `create_organization()`.

### `profiles`

1:1 con `auth.users`. `id uuid pk references auth.users(id) on delete
cascade`, `first_name`, `last_name`, `phone`, `avatar_url`, timestamps.
Creada automáticamente por el trigger `handle_new_user()` en el insert de
`auth.users`. RLS: el usuario solo ve/edita su propia fila (`id = auth.uid()`).

### `memberships`

| columna         | tipo                    | notas                                 |
| --------------- | ----------------------- | ------------------------------------- |
| id              | uuid pk                 |                                       |
| organization_id | uuid fk → organizations |                                       |
| user_id         | uuid fk → auth.users    |                                       |
| role            | text default 'owner'    | `check in ('owner','admin','member')` |
| created_at      | timestamptz             |                                       |
|                 |                         | `unique (organization_id, user_id)`   |

Índices: `user_id`, `organization_id`. RLS: SELECT para miembros de la misma
organización. Sin INSERT/UPDATE/DELETE directo.

### Funciones

- `private.user_org_ids()` — SECURITY DEFINER, `setof uuid`: organizaciones
  del usuario actual. Reutilizada por el resto de las políticas RLS a partir
  de la Fase 1.
- `public.create_organization(p_name, p_slug, p_timezone, p_currency,
p_main_area, p_first_name, p_last_name, p_phone) returns uuid` — SECURITY
  DEFINER: crea la organización, el membership `owner` del usuario actual, y
  completa su profile. Única vía de escritura a `organizations`/`memberships`.
- `public.set_updated_at()` — trigger reutilizable para `updated_at`.

## Implementado (Fase 1)

### `contacts`

`id, organization_id, first_name, last_name, phone, whatsapp, email, dni,
birth_date, address, profession, source, archived_at, created_at,
updated_at, created_by`. Índices sobre `organization_id`, `phone`, `email`,
`dni` (para detección de duplicados, sección 66 del brief). DNI no se expone
en listados por defecto — solo en la ficha individual.

Dos decisiones que se apartan del listado literal del brief, documentadas
acá porque no son obvias leyendo el código:

- **`source` es `text` + `check`, no `source_id` a una tabla de lookup.**
  Es el mismo patrón "enum-like" usado en el resto del esquema, y evita una
  tabla de 11 filas fijas para algo que cambia rarísima vez.
- **No hay columna `notes` en `contacts`.** El brief la lista, pero ya existe
  la tabla `notes` (con `contact_id`) para exactamente ese propósito, con
  timestamp y autoría — tener las dos sería el mismo dato en dos lugares sin
  que quede claro cuál mirar. Se usa solo la tabla.

### `contact_roles`

`id, contact_id fk, role text check in ('buyer','seller','owner','investor',
'tenant','landlord','referrer','past_client','other'), created_at`, con
`unique (contact_id, role)`. Un contacto puede tener N roles simultáneos —
por eso es tabla aparte y no una columna rígida `client_type` en `contacts`.
No tiene `organization_id` propio (es un junction 1:N estrictamente atado a
`contacts`); su RLS revalida pertenencia vía `EXISTS` contra `contacts`.

### `notes`

`id, organization_id, body, contact_id, created_by, created_at, updated_at`.
Fase 1 solo agrega `contact_id` — `property_id`/`deal_id`/`search_id`/
`acquisition_id`/`lead_id` se agregan como columnas nullable en la migración
de la fase que introduce cada una de esas tablas (nunca modificando esta
migración ya aplicada).

### `tasks`

`id, organization_id, title, description, contact_id, priority text check in
('low','medium','high','urgent'), due_at, status text check in ('pending',
'in_progress','completed','cancelled'), assigned_to, completed_at,
created_at, updated_at, created_by`. Índices sobre `due_at`, `status`,
`organization_id`, `contact_id`. Mismo criterio que `notes` sobre los FK de
contexto todavía no agregados.

### `activities`

`id, organization_id, type text check in ('call','whatsapp','email',
'meeting','virtual_meeting','property_visit','acquisition_visit','valuation',
'notary_meeting','reservation','contract_signing','closing','follow_up',
'other'), title, description, contact_id, starts_at, ends_at check (ends_at
is null or starts_at <= ends_at), status text check in ('scheduled',
'completed','cancelled'), location, meeting_url, google_event_id,
created_by, created_at, updated_at`. Base de los timelines.

### `contact_overview` (vista)

`security_invoker` view sobre `contacts` que precalcula `roles` (array
agregado desde `contact_roles`), `last_interaction_at` (última `activity`
completada) y `next_action_at` (`due_at` más próximo entre las tareas
pendientes) en una sola query — así el listado de contactos no hace una
consulta por fila para mostrar esos dos datos. `security_invoker = true`
significa que corre con los permisos de quien consulta, así que el RLS de
`contacts`/`contact_roles`/`activities`/`tasks` se sigue aplicando a través
de la vista; no es un bypass.

### RLS de Fase 1

Simplificado a propósito: cualquier miembro de la organización puede
leer/escribir sus contactos/notas/tareas/actividades — sin restricción por
fila (p. ej. "solo quien creó la tarea puede completarla"). Tiene sentido
mientras haya un solo asesor por organización; se ajusta cuando haya
equipos reales que lo necesiten (ver docs/ARCHITECTURE.md).

## Implementado (Fase 2)

### `properties`

`id, organization_id, title, property_type text check in ('apartment',
'house','ph','land','office','commercial','warehouse','other'),
operation_type text check in ('sale','rent','temporary_rent'), street,
street_number, floor, unit, city, neighborhood, province, country, latitude,
longitude, price numeric, currency, bedrooms, bathrooms, garage_spaces,
total_area, covered_area, uncovered_area, lot_area, expenses numeric,
age_years, description, internal_notes, status text check in ('draft',
'valuation','capturing','active','reserved','sold','rented','paused','lost',
'archived'), publication_url, external_reference, archived_at, created_at,
updated_at, created_by`. `check (price is null or currency is not null)` —
no se puede cargar precio sin moneda. Índices sobre `organization_id`,
`status`, `operation_type`, `city`.

El formulario de Fase 2 no expone todavía `floor`/`unit`/`latitude`/
`longitude`/`uncovered_area`/`lot_area`/`age_years`/`internal_notes`/
`publication_url`/`external_reference` — las columnas ya existen (para no
tener que migrar de nuevo), la UI las suma cuando haga falta (captaciones,
mapa, portales).

### `property_owners`

`property_id fk, contact_id fk, ownership_percentage numeric check (0 <
ownership_percentage <= 100), is_primary_contact boolean default false,
notes, created_at` — PK compuesta `(property_id, contact_id)`. Mismo patrón
que `contact_roles`: sin `organization_id` propio, RLS vía `EXISTS` contra
`properties`.

### `property_overview` (vista)

Mismo patrón que `contact_overview`: `security_invoker` view que agrega
`primary_owner_name` (el propietario marcado `is_primary_contact`, o el más
antiguo si no hay ninguno marcado) para que el listado de propiedades no
haga una consulta por fila.

### `notes` / `tasks` / `activities`

Se les agregó la columna nullable `property_id` (ALTER TABLE, sin tocar la
migración de Fase 1) — el mismo registro de nota/tarea/actividad ahora puede
colgar de un contacto o de una propiedad. La capa de datos/acciones se
generalizó (`lib/data/engagement.ts`, `lib/actions/engagement.ts`) para no
duplicar las cuatro operaciones (notas, tareas, completar tarea, actividad)
entre `contacts` y `properties`.

## Implementado (Fase 3)

### `property_acquisitions`

`id, organization_id, property_id fk not null, primary_owner_contact_id fk
not null, status text check in ('new_lead','contacted','meeting_scheduled',
'meeting_completed','valuation','proposal_sent','follow_up','won','lost')
default 'new_lead', origin (mismo enum que `contacts.source`),
estimated_value numeric, proposed_listing_price numeric, valuation_date,
meeting_date, lost_reason, notes, created_at, updated_at`.
Índices sobre `organization_id`, `property_id`, `status`.

**Actualizado en Fase 6:** esta tabla tenía originalmente una columna
`next_action_at timestamptz` que nada escribía nunca — un bug real
detectado al planificar `deals` (docs/ROADMAP.md, Fase 6). Se eliminó y se
reemplazó por `acquisition_overview` (vista `security_invoker`, mismo
patrón que `contact_overview`/`property_overview`/`search_overview`/
`lead_overview`), que calcula `next_action_at` desde `tasks` en vez de
depender de un valor que nadie setea. `lib/data/acquisitions.ts` lee de la
vista; el resto de la UI no cambió (mismo nombre de columna).

`primary_owner_contact_id` duplica algo que también vive en
`property_owners` (Fase 2) — es intencional: la tarjeta del Kanban necesita
"con quién estoy negociando esta captación" sin hacer join a
`property_owners`, y ese contacto no siempre es el mismo que "el"
propietario principal si la propiedad termina con varios (el contacto de la
negociación queda fijo al crear la captación). Documentado acá por la regla
de "datos derivados" (sección de RLS/índices más abajo y docs/ARCHITECTURE.md).

El flujo de creación (`/acquisitions/new`) arranca desde "propietario
interesado en vender" (ver docs/PRODUCT_SPEC.md), no desde una propiedad ya
cargada: crea la `property` (mínima, `status='capturing'`), el
`property_owners` (`is_primary_contact=true`) y la `property_acquisitions`
en la misma acción de servidor.

### `valuations`

`id, organization_id, property_id fk not null, acquisition_id fk nullable,
estimated_min_value, estimated_value, estimated_max_value numeric — check
(estimated_min_value <= estimated_max_value), currency,
recommended_listing_price, valuation_date date default hoy, notes,
created_by, created_at`. Índices sobre `property_id`, `acquisition_id`.

### `notes` / `tasks` / `activities`

Ganaron `acquisition_id` (mismo patrón que `property_id` en Fase 2 — ALTER
TABLE nullable, sin tocar migraciones previas). `lib/data/engagement.ts` y
`lib/actions/engagement.ts` ahora aceptan `{ contactId, propertyId,
acquisitionId }` indistintamente.

### Kanban de captaciones

`/acquisitions` usa [`@dnd-kit/core`](https://dndkit.com) para drag & drop
entre columnas de estado — librería chica (~10kb), mantenida, con soporte
táctil real (a diferencia del drag & drop nativo de HTML5, que no funciona
bien en mobile — relevante porque el asesor va a usar esto desde el
teléfono). Al soltar una tarjeta se actualiza el estado optimísticamente en
el cliente y se persiste con `updateAcquisitionStatus()`. También hay vista
tabla (`?view=table`).

## Implementado (Fase 4)

### `property_searches`

`id, organization_id, contact_id fk not null (a diferencia de
`property_acquisitions`, acá el dueño del registro siempre es un contacto,
nunca una propiedad — una búsqueda no tiene "propiedad" hasta que
eventualmente conecta con una), operation_type text check in ('sale','rent',
'temporary_rent') default 'sale', property_types text[] not null default
'{}' check (<@ contra el mismo set de tipos que `properties.type`), min_price,
max_price numeric(14,2) — check min_price <= max_price, currency text check
in ('ARS','USD'), cities text[], neighborhoods text[] not null default '{}',
min_bedrooms, max_bedrooms smallint — check min <= max,
min_total_area, min_covered_area numeric(10,2),
requires_garage/balcony/patio/elevator boolean not null default false,
must_have, nice_to_have text, objective text check in (11 valores —
`primary_residence`, `investment`, `traditional_rent`, `temporary_rent`,
`relocation`, `liquidity_need`, `inheritance`, `separation`, `city_change`,
`portfolio_expansion`, `other`), urgency text check in ('high','medium',
'low'), expected_decision_date date, financing_required boolean not null
default false, status text check in ('new','qualified','searching',
'options_sent','visiting','negotiating','reserved','closed','paused',
'lost') default 'new', notes text, created_at, updated_at`. Índices sobre
`organization_id`, `contact_id`, `status`.

### `notes` / `tasks` / `activities`

Ganaron `search_id` (mismo patrón ALTER TABLE nullable que `property_id`
en Fase 2 y `acquisition_id` en Fase 3). `EngagementContext` en
`lib/data/engagement.ts`/`lib/actions/engagement.ts` ahora acepta
`{ contactId, propertyId, acquisitionId, searchId }`.

### `search_overview` (vista, `security_invoker`)

Igual que `property_overview`/`contact_overview`: evita N+1 en el listado.
Hace join a `contacts` para traer `contact_first_name`/`contact_last_name`
(la búsqueda no tiene nombre propio, se lista por el cliente dueño), y
subqueries de `max(activities.starts_at)` → `last_interaction_at` y
`min(tasks.due_at) where status <> 'completed'` → `next_action_at`, igual
patrón que las otras vistas overview.

**Gotcha verificado (Fase 4):** `last_interaction_at` es un timestamp real
(hora exacta de la actividad) pero se muestra en las listas truncado a
"día" — ver la nota sobre timezones en docs/ARCHITECTURE.md antes de tocar
`lib/format.ts` o de agregar una columna de fecha nueva a cualquier
`*_overview`.

## Implementado (Fase 5)

### `leads`

`id, organization_id, first_name text not null, last_name, phone, email,
message, source (mismo enum que `contacts.source`/`property_acquisitions.origin`— no un`source_id` separado, mismo criterio de reutilización que Fase 3),
property_id fk nullable on delete set null, status text check in ('new',
'contacted','qualified','converted','not_interested','unresponsive','lost')
default 'new', assigned_to uuid references auth.users (reservado para
equipos, sin UI todavía), contact_id fk nullable on delete set null,
search_id fk nullable on delete set null, notes, first_contact_at,
converted_at, created_at, updated_at`. Índices sobre `organization_id`,
`status`, `property_id`, `contact_id`.

`contact_id`/`search_id` son `on delete set null` (no `cascade`) a
propósito: un lead es un registro histórico de cómo llegó una consulta, y
debe sobrevivir aunque el contacto o la búsqueda resultante se borren más
adelante — mismo criterio de "conservar historial" que la regla de negocio
7 del spec.

### `notes` / `tasks` / `activities`

Ganaron `lead_id` (mismo patrón ALTER TABLE nullable que en Fases 2-4).

### `lead_overview` (vista, `security_invoker`)

Mismo patrón que `contact_overview`/`property_overview`/`search_overview`:
precomputa `last_interaction_at` (`max(activities.starts_at)`) y
`next_action_at` (`min(tasks.due_at)` con `status <> 'completed'`) para
evitar N+1 en el inbox. La UI de `/leads` solo muestra `next_action_at`
("Próxima acción") — `last_interaction_at` se trae pero no se usa todavía
en ninguna columna; queda disponible para cuando el inbox necesite
ordenar por "hace cuánto no le escribo".

### Conversión: lead → contacto + búsqueda

El flujo completo vive en `app/(dashboard)/leads/actions.ts` +
`components/leads/convert-lead-form.tsx`:

1. `checkLeadDuplicates` reutiliza `findPossibleDuplicates` (la misma
   función de Fase 1, sin duplicar lógica) para avisar — nunca bloquear —
   sobre un contacto existente con el mismo teléfono/email.
2. Si el asesor elige un match existente, `convertLeadToExistingContact`
   solo vincula `lead.contact_id`, sin crear nada.
3. Si elige crear de todas formas (o no hay match), `convertLeadToNewContact`
   crea el contacto y vincula el lead.
4. Ambos caminos terminan con `redirect` a `/searches/new?contactId=...&leadId=...`
   — la creación de la búsqueda reutiliza el formulario completo de Fase 4
   en vez de duplicar sus ~15 campos en un formulario de conversión aparte.
5. `createSearch` (en `searches/actions.ts`) lee el `leadId` oculto del
   formulario y, si está presente, actualiza `leads.search_id` +
   `status='converted'` al crear la búsqueda — cerrando el círculo sin que
   `searches/actions.ts` necesite saber nada más de leads que ese único
   campo oculto.

Esto significa que "convertir un lead" nunca duplica un contacto ni una
búsqueda (regla de negocio 6 del spec), verificado en vivo con tres casos:
vincular a un contacto existente, crear uno nuevo de cero, y forzar la
creación de todas formas pese a un match de teléfono.

## Implementado (Fase 6)

### `deals`

`id, organization_id, property_id fk not null, buyer_contact_id fk not
null, seller_contact_id fk not null, deal_type (mismo enum que
`properties.operation_type`/`property_searches.operation_type` —
sale/rent/temporary_rent), status text check in ('negotiation','offer',
'reservation','documentation','contract','closing','closed','cancelled')
default 'negotiation', asking_price, offer_price, agreed_price
numeric(14,2), currency text check in ('ARS','USD'), reservation_date,
contract_date, closing_date date, estimated_commission numeric(14,2),
commission_currency text check in ('ARS','USD'), notes, created_at,
updated_at, created_by`. Índices sobre `organization_id`, `property_id`,
`buyer_contact_id`, `seller_contact_id`, `status`.

`buyer_contact_id`/`seller_contact_id` son NOT NULL a propósito — a
diferencia de una captación (todavía no hay comprador) o una búsqueda
(todavía no hay propiedad), una operación solo tiene sentido una vez que
hay un comprador y un vendedor concretos negociando una propiedad
concreta. No hay flujo de creación "desde cero" como en captaciones:
`/deals/new` asume que la propiedad y ambos contactos ya existen.

### `notes` / `tasks` / `activities`

Ganaron `deal_id` (mismo patrón ALTER TABLE nullable que en todas las
fases anteriores).

### `deal_overview` (vista, `security_invoker`)

Mismo patrón que el resto de las vistas `*_overview`:
`last_interaction_at`/`next_action_at` calculados desde `activities`/
`tasks` desde el primer momento — a propósito, para no repetir el bug
real de Fase 3 (columna `next_action_at` que nadie escribía, corregido en
esta misma fase, ver la nota en `property_acquisitions` más arriba).

### Kanban de operaciones

`/deals` reutiliza `@dnd-kit/core` con los tres fixes ya documentados en
docs/ARCHITECTURE.md desde el primer commit (activationConstraint,
DndContext id fijo, opciones de sensor a nivel de módulo) — verificados
en vivo de nuevo acá, sin necesidad de redescubrirlos.

## Fase 7 — sin migración

`/today` no agrega tablas ni columnas — es una capa de consultas nueva
(`lib/data/today.ts`) sobre `tasks`/`activities` y las vistas
`search_overview`/`acquisition_overview`/`deal_overview` que ya existían.
Dos piezas nuevas de infraestructura, ninguna de esquema:

- `lib/date.ts`: calcula los límites de "hoy" en la zona horaria del
  negocio (Argentina) en vez de la zona implícita del proceso — ver el
  gotcha en docs/ARCHITECTURE.md.
- El resolver de entidades (`resolveEngagementLinks`, extraído en Fase 8 a
  `lib/data/engagement-links.ts` porque `/calendar` también lo necesita):
  dado que `tasks`/`activities` pueden estar atadas a cualquiera de los
  seis tipos de entidad (contacto/propiedad/captación/búsqueda/lead/
  operación), resuelve el link + label correcto para cada uno en lotes
  (mismo criterio "evitar N+1" que `lib/data/acquisitions.ts`/
  `lib/data/deals.ts`), en vez de asumir que solo hay `contact_id` como
  hacía el código de Fase 0.

## Fase 8 — sin migración

`/calendar` reutiliza `activities` (Fase 1) tal cual — sin tablas ni
columnas nuevas. Hasta esta fase, la única forma de crear una fila en
`activities` era el registro rápido (`logActivity`, Fase 1), que siempre
inserta `status: 'completed'` y `starts_at: now()` — no existía ningún
camino para agendar algo a futuro (`status: 'scheduled'`). `/calendar/new`
es la primera pantalla que inserta actividades `scheduled`, lo que a su
vez es lo que hace que "Agenda de hoy" en `/today` (Fase 7) empiece a
mostrar datos reales.

`lib/date.ts` se extiende con:

- Aritmética de grilla de calendario (`getMonthGridYmds`, `getWeekYmds`,
  `addDaysToYmd`, ...), toda en UTC puro (ver el comentario del archivo
  sobre por qué no se usa `date-fns` para esto pese a estar instalado).
- `businessDateTimeToUtcIso`/`utcIsoToBusinessDateTimeLocal`: conversión
  de ida y vuelta entre un `<input type="datetime-local">` (que no lleva
  zona horaria) y un instante UTC correcto — ver el gotcha nuevo en
  docs/ARCHITECTURE.md.

## Fase 9 — implementado

### `google_calendar_connections`

`user_id uuid primary key references auth.users (id) on delete cascade,
google_email, access_token not null, refresh_token not null,
token_expiry timestamptz not null, calendar_id text not null default
'primary', created_at, updated_at`.

1:1 con `auth.users`, igual que `profiles` — sin `organization_id`. Es
deliberado: una conexión de Google es una credencial personal del asesor
(su propia cuenta de Google), no un dato de negocio compartido por la
organización, así que no sigue el patrón `organization_id in (select
private.user_org_ids())` del resto de las tablas — la política RLS es
"solo el dueño de la fila" (`user_id = auth.uid()`), sin excepción ni para
otros miembros de la misma organización.

**Límite conocido, documentado a propósito:** los tokens no están
cifrados a nivel de columna (pgcrypto) — cifrarlos introduce su propio
problema de dónde guardar la clave de cifrado, que para una MVP de un
solo asesor no se justifica todavía. La seguridad se apoya en RLS (dueño
únicamente) + que los tokens nunca salen del servidor (ningún Server
Action/Route Handler los expone al cliente) + el cifrado en reposo que
Supabase ya provee a nivel de infraestructura para toda la base. Revisar
si esto deja de alcanzar cuando haya más de un asesor por organización.

`activities.google_event_id` (Fase 1, sin usar hasta ahora) es donde se
guarda el id del evento espejo en Google — no hace falta ninguna columna
nueva en `activities`.

## Fase 10 — sin migración

`/dashboard` no agrega tablas ni columnas — es una capa de consultas nueva
(`lib/data/dashboard.ts`) sobre `leads`/`activities`/`deals`/
`property_acquisitions`/`property_searches`, todas ya existentes.

- Los embudos (`getAcquisitionFunnel`/`getSearchFunnel`/`getDealFunnel`)
  son "cohortes por fecha de creación": no hay ninguna tabla de historial
  de transiciones de estado en el esquema, así que la única forma honesta
  de armar un embudo por período es filtrar las filas cuyo `created_at`
  cae en el período elegido y agruparlas por su `status` ACTUAL — no por
  la etapa en la que estaban en cada momento del período. Es una
  aproximación deliberada, documentada en la propia página
  (`app/(dashboard)/dashboard/page.tsx`): un embudo con historial real
  requeriría una tabla de auditoría de cambios de estado, que queda fuera
  de alcance hasta que haga falta.
- Los KPIs con fecha inequívoca no pasan por cohorte: `leads` usa
  `created_at` (nuevos) y `converted_at` (convertidos) directamente;
  `activities` usa `starts_at` para contar visitas; `deals` usa
  `closing_date` para cierres y comisión — cada uno filtrado por la
  columna que efectivamente representa ese evento, no por cuándo se creó
  el registro.
- `deals.closing_date` es un `date` nativo de Postgres, no un
  `timestamptz`: se compara directamente contra strings "YYYY-MM-DD"
  (`lib/date.ts:getPeriodYmdRange`), sin necesidad de convertir a límites
  UTC como sí hace falta para `created_at`/`starts_at` (ver
  `getBusinessRangeBoundsUtc` en docs/ARCHITECTURE.md).
- Cada consulta de embudo trae como máximo 2000 filas (`FUNNEL_ROW_LIMIT`
  en `lib/data/dashboard.ts`) y agrupa en memoria — de sobra para el
  volumen de un solo asesor, y evita una consulta de agregación por cada
  una de las ~9 etapas posibles de cada pipeline.

## Fase 11 — sin migración

`/searches/[id]` y `/properties/[id]` no agregan tablas ni columnas —
"Coincidencias" es una capa de consultas + cálculo (`lib/matching/score.ts`,
puro; `lib/data/matching.ts`, consultas) sobre `properties`/
`property_searches`, ambas ya existentes. Nada se persiste: el
`match_score` se calcula en el momento de renderizar la página, no en cada
escritura — con el volumen de un solo asesor no hace falta cachearlo.

- Filtros duros primero (`isPropertyEligibleForSearch`): `operation_type`
  igual, y si la búsqueda especificó `property_types`, la propiedad tiene
  que estar en esa lista. Lo que no pasa esto ni siquiera se puntúa — se
  excluye de la lista directamente, no aparece con un puntaje bajo.
- Sobre los candidatos que pasan el filtro, un puntaje ponderado
  (presupuesto 35, ubicación 25, ambientes 20, superficie 10, cochera 10)
  donde cada criterio solo cuenta si HAY dato de los dos lados —
  normalizado contra el peso de los criterios aplicables, para que una
  búsqueda con pocas restricciones no salga perjudicada por "datos
  faltantes" que nunca pidió, y una propiedad con un campo vacío tampoco
  quede en cero de forma injusta.
- **Límite conocido, documentado a propósito:** `property_searches` tiene
  `requires_balcony`/`requires_patio`/`requires_elevator`, pero
  `properties` no tiene ninguna columna de amenities equivalente — no hay
  nada contra qué compararlos, así que esos tres requisitos nunca se
  puntúan. Solo `requires_garage` se puntúa, contra `garage_spaces`.
  Agregar esas columnas a `properties` es la extensión natural si hace
  falta más precisión, pero no se justificó agregarlas solo para esta
  fase (regla general del proyecto: no anticipar columnas sin un caso de
  uso ya construido que las necesite).
- Solo se consideran propiedades `capturing`/`active` (no `draft`/
  `valuation` — sin precio todavía; no `reserved`/`sold`/`rented`/
  `paused`/`lost`/`archived` — ya no disponibles) y búsquedas en estado
  abierto (no `reserved`/`closed`/`paused`/`lost`). Cada consulta de
  candidatos trae como máximo 500 filas (`CANDIDATE_ROW_LIMIT`) y se
  puntúa/ordena en memoria, mismo criterio que Fase 10; el resultado se
  recorta a las 20 mejores coincidencias (`MAX_MATCHES`) — es una lista
  corta para que la lea una persona, no algo paginado.
- `getSearchMatchesForProperty` lee de `search_overview` (Fase 4) en vez de
  `property_searches` directo, para traer el nombre del contacto sin una
  consulta aparte.

## Fase 12 — implementado

### `tasks.category` (columna nueva)

`category text check (category is null or category in ('follow_up_postventa',
'follow_up_anniversary', 'follow_up_birthday'))`, nullable, sin default.

Es la única columna nueva de la fase. `contact_roles` no necesitó ningún
cambio: `past_client`/`referrer` ya estaban en el check constraint desde
la Fase 1 (nadie los asignaba automáticamente hasta ahora).

Sirve para dos cosas: (1) que el cron (`lib/data/retention.ts`) pueda
preguntar "¿ya existe una task de esta categoría para este deal/contacto
[en este año]?" antes de insertar, sin depender de parsear el título —
una columna estructurada es más confiable y no se rompe si el título
cambia de redacción; (2) diferenciar en la UI, si hiciera falta más
adelante, una task que generó el sistema de una que cargó el asesor a
mano. Las tasks manuales quedan con `category = null`, como siempre.

### Primer uso real de `SUPABASE_SERVICE_ROLE_KEY`

Reservada sin usar desde la Fase 0 (`.env.example`). El cron de
retención (`app/api/cron/retention-tasks`) no tiene ningún usuario
logueado — lo dispara Vercel Cron por HTTP plano — así que la política
RLS `organization_id in (select private.user_org_ids())`, que depende de
`auth.uid()`, no le serviría de nada: necesita leer/escribir en todas las
organizaciones. `lib/supabase/service-role.ts` crea un cliente con la
service role key que bypassea RLS por completo — documentado ahí mismo
para que nadie lo use por error en un request de un usuario real (para
eso sigue estando `lib/supabase/server.ts`, que sí respeta RLS).

### Por qué `tasks.assigned_to`/`created_by` quedan `null` en estas tasks

El cron corre con la service role, sin ningún `auth.uid()` de por medio,
así que esas dos columnas (que además nunca se leen en ningún lado del
código — son "schema-ready pero sin UI", mismo patrón que
`leads.assigned_to` desde la Fase 7) quedan en su default (`null`/
`auth.uid()` evaluado como `null` fuera de una sesión). No afecta nada:
como es un solo asesor por organización, ninguna pantalla filtra tasks
por "asignadas a mí".

## V2 bloque B — `acquisition_overview` extendida

`create or replace view` (aditivo, sin romper ningún `select *` previo)
agregando dos columnas que `search_overview`/`deal_overview` ya tenían o
necesitaban:

- `last_interaction_at`: `max(activities.starts_at) where status =
'completed'` — mismo criterio que `search_overview` (no
  `deal_overview`, que no filtra por status; inconsistencia preexistente
  entre esas dos vistas, detectada durante esta auditoría pero no
  corregida acá para no tocar `deal_overview` sin que este bloque lo
  pidiera — ver docs/V2_EVOLUTION_PLAN.md).
- `pending_tasks_count`: `count(*)` de tasks `pending`/`in_progress` —
  nuevo, ninguna de las 4 vistas `*_overview` lo tenía todavía. Alimenta
  la columna "Pendientes" de `/acquisitions`.

`insertAcquisitionRecord` (`app/(dashboard)/acquisitions/actions.ts`,
interno, no exportado) es el único lugar que inserta
`properties`+`property_owners`+`property_acquisitions` juntos — lo usan
tanto el formulario completo (`createAcquisition`) como las dos ramas de
"captación rápida", para que nunca haya dos caminos de escritura para el
mismo resultado.

## V2 bloque C — `property_price_history`

`id, organization_id, property_id, previous_price, new_price, currency,
change_reason, changed_by, changed_at`. No es lo mismo que `valuations`
(Fase 3) — esa es el análisis de tasación previo a publicar (estimado
min/max/recomendado), esta es el registro real de cambios al
`properties.price` que efectivamente se publicó. Confirmado por auditoría
que no existía ninguna estructura equivalente.

Escrita exclusivamente por el trigger `properties_log_price_change`
(`after update on properties`, `when (old.price is distinct from
new.price)`) — nunca por código de la aplicación. La función del trigger
es `security definer` (mismo patrón que `create_organization()`/
`handle_new_user()` de la Fase 0): corre con los privilegios de quien la
definió, no de quien hizo el `update`, así que puede escribir en
`property_price_history` aunque esa tabla no tenga ninguna política de
`insert` para `authenticated` — la única forma de generar una fila es a
través del trigger. `change_reason` queda nullable y sin UI que lo cargue
todavía (no hay un caso de uso construido que lo pida).

## V2 bloque D — `visit_feedback`

`id, organization_id, activity_id, interest_level, positive_feedback,
negative_feedback, price_perception, wants_to_proceed, notes, created_by,
created_at, updated_at`, `unique (activity_id)`. No se agregó ninguna
columna a `activities` — `property_visit`/`acquisition_visit` (Fase 1) ya
representan correctamente el evento; esto es solo la estructura de
feedback que un subconjunto de tipos de actividad necesita, separada para
no llenar `activities` de columnas que no aplican al resto.

A diferencia de `property_price_history` (Bloque C), esta tabla SÍ la
escribe la aplicación directamente (RLS estándar, `for all` con el mismo
patrón `organization_id in (select private.user_org_ids())` de siempre) —
no hace falta un trigger porque lo que la dispara es una acción explícita
del asesor ("Finalizar visita"), no un cambio de columna en otra tabla
que haya que interceptar.

`unique (activity_id)` + `upsert` desde `finalizeVisit` significa que
reabrir el diálogo sobre una visita ya finalizada edita el feedback en
vez de crear una fila duplicada.

## V2 bloque E — `offers`

`id, organization_id, property_id, contact_id, deal_id, amount, currency,
status, conditions, expiration_date, parent_offer_id, notes, created_by,
created_at, updated_at`. RLS estándar (`for all`, mismo patrón de
`organization_id in (select private.user_org_ids())` de siempre).

No es lo mismo que `deals` (Fase 6): `deals` es la operación en curso,
`offers` es lo que pasa antes — una propuesta de precio sobre una
propiedad. `deal_id` es nullable y se completa recién cuando la oferta se
acepta (`acceptOfferAndCreateDeal`, `app/(dashboard)/properties/
actions.ts`), momento en el que también se decide si crear una operación
nueva o vincular una ya existente para esa propiedad
(`getOpenDealForProperty`) — nunca se crean dos operaciones para la misma
negociación.

Las contraofertas son filas nuevas encadenadas por `parent_offer_id`,
nunca un `update` del monto de la fila anterior — el historial completo
de la negociación queda intacto. Al crear una contraoferta, la oferta
padre pasa a `status = 'counter_offered'` para que quede claro cuál sigue
"viva" (la más nueva que no fue ella misma contraofertada).

`contact_id` se mantiene igual en toda la cadena de una negociación (la
contraparte con la que se negocia) — no se modela "de qué lado" vino cada
contraoferta; es un dato que el asesor ya tiene con solo leer fecha/monto,
y agregar una columna para esto sin un caso de uso que lo pidiera hubiera
sido anticipar de más.

## V2 bloque G — `property_recommendations`

`id, organization_id, property_id, search_id, contact_id, sent_at,
channel, status, notes, created_by, created_at, updated_at`. RLS estándar.

Distinta de un match de la Fase 11 (`lib/matching/score.ts`): un match es
un score calculado al vuelo, nunca persistido; esta tabla registra que
una propiedad efectivamente se le envió a un cliente para una búsqueda
puntual — "Registrar envío" desde Coincidencias, en ambas fichas
(propiedad y búsqueda).

`search_id` + `contact_id` son deliberadamente redundantes (`contact_id`
ya es derivable de `search_id`) — se guardan los dos para no forzar un
join en cada consulta desde la ficha de cliente, mismo criterio de
denormalización controlada que otras vistas `*_overview` del proyecto.

Sin `unique (property_id, search_id)`: volver a presentar la misma
propiedad más adelante (por ejemplo tras una baja de precio) es una
acción real, no un error a impedir.

## V2 bloque H — sin migración

Último bloque del plan V2 (docs/V2_EVOLUTION_PLAN.md) — solo lecturas
nuevas sobre tablas ya existentes, mismo criterio que la Fase 10:

- "Tasaciones": `valuations.valuation_date` (nativo `date`) filtrado
  directo por el rango del período — misma lógica que `closing_date` en
  "Cierres".
- "Reservas": `deals.reservation_date` filtrado por rango, pero además
  gateado a `status in ('reservation','documentation','contract',
'closing','closed')` — igual que "Cierres" gatea en `status =
'closed'`: `reservation_date` es un campo editable del formulario de la
  operación, así que una fecha cargada no prueba por sí sola que la
  operación efectivamente llegó a ese hito.
- "Leads respondidos": cohorte por `created_at` (mismo criterio que los
  embudos) con `status <> 'new'` como condición — no existe una columna
  de "primera respuesta" en el esquema, así que esta es la señal más
  honesta disponible, documentada como tal en el código
  (`lib/data/dashboard.ts`).
- "Propiedades captadas" no agregó ninguna consulta: reutiliza el bucket
  `won` que `getAcquisitionFunnel` (Fase 10) ya calculaba para ese mismo
  período.

## Índices previstos (más allá de las PK/FK)

`organization_id`, `contact_id`, `property_id`, `status`, `due_at`,
`starts_at`, `created_at`, `phone`, `email` en cada tabla donde aplique, y
combinaciones frecuentes (`organization_id, status`, `organization_id,
due_at`) si el uso real lo justifica — no especular de más.

## RLS a partir de la Fase 1

Cada tabla de negocio nueva repite el mismo patrón simple (ver "RLS de Fase
1" arriba sobre por qué es `for all` sin restricción por fila todavía):

```sql
alter table public.<tabla> enable row level security;

create policy "Members can manage <tabla> in their organization"
  on public.<tabla> for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));
```

Para tablas junction sin `organization_id` propio (`contact_roles`,
`property_owners`), la misma política pero con `EXISTS` contra la tabla
padre en vez del `in (select private.user_org_ids())` directo.
