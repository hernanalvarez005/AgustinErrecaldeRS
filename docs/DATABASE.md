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
meeting_date, next_action_at, lost_reason, notes, created_at, updated_at`.
Índices sobre `organization_id`, `property_id`, `status`.

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

### `deals` (Fase 6)

`id, organization_id, property_id fk not null, buyer_contact_id fk,
seller_contact_id fk, deal_type, status text check in ('negotiation','offer',
'reservation','documentation','contract','closing','closed','cancelled'),
asking_price, offer_price, agreed_price numeric, currency, reservation_date,
contract_date, closing_date, estimated_commission numeric,
commission_currency, notes, created_at, updated_at, created_by`.

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
