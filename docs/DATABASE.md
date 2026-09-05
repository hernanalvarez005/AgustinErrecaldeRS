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

## Planificado (Fase 2 en adelante)

Esquema propuesto para el resto del dominio. Se implementa incrementalmente,
una migración por fase (ver docs/ROADMAP.md), no todo de una vez.

### `properties` (Fase 2)

`id, organization_id, title, property_type text check in ('apartment',
'house','ph','land','office','commercial','warehouse','other'),
operation_type text check in ('sale','rent','temporary_rent'), street,
street_number, floor, unit, city, neighborhood, province, country, latitude,
longitude, price numeric, currency, bedrooms, bathrooms, garage_spaces,
total_area, covered_area, uncovered_area, lot_area, expenses numeric,
age_years, description, internal_notes, status text check in ('draft',
'valuation','capturing','active','reserved','sold','rented','paused','lost',
'archived'), publication_url, external_reference, archived_at, created_at,
updated_at, created_by`.

### `property_owners` (Fase 2)

`property_id fk, contact_id fk, ownership_percentage numeric, is_primary_contact
boolean, notes` — PK compuesta `(property_id, contact_id)`.

### `property_acquisitions` (Fase 3)

`id, organization_id, property_id fk, primary_owner_contact_id fk, status
text check in ('new_lead','contacted','meeting_scheduled','meeting_completed',
'valuation','proposal_sent','follow_up','won','lost'), origin,
estimated_value numeric, proposed_listing_price numeric, valuation_date,
meeting_date, next_action_at, lost_reason, notes, created_at, updated_at`.

### `valuations` (Fase 3)

`id, organization_id, property_id fk, acquisition_id fk, estimated_min_value,
estimated_value, estimated_max_value numeric — check (estimated_min_value <=
estimated_max_value), currency, recommended_listing_price, valuation_date,
notes, created_by, created_at`.

### `property_searches` (Fase 4)

`id, organization_id, contact_id fk, operation_type, property_types text[],
min_price, max_price numeric — check (min_price <= max_price), currency,
cities text[], neighborhoods text[], min_bedrooms, max_bedrooms,
min_total_area, min_covered_area, requires_garage/balcony/patio/elevator
boolean, must_have, nice_to_have text, objective, urgency, expected_decision_date,
financing_required boolean, status text check in ('new','qualified',
'searching','options_sent','visiting','negotiating','reserved','closed',
'paused','lost'), notes, created_at, updated_at`.

### `leads` (Fase 5)

`id, organization_id, first_name, last_name, phone, email, message, source_id,
property_id fk, status text check in ('new','contacted','qualified',
'converted','not_interested','unresponsive','lost'), assigned_to, created_at,
first_contact_at, converted_at, contact_id fk nullable, search_id fk
nullable, notes`.

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

Cada tabla nueva repite el mismo patrón que `organizations`:

```sql
alter table public.<tabla> enable row level security;

create policy "Members can view <tabla> in their organization"
  on public.<tabla> for select
  to authenticated
  using (organization_id in (select private.user_org_ids()));

-- INSERT/UPDATE/DELETE con la misma condición en WITH CHECK,
-- ajustando por rol donde corresponda (p.ej. solo owner/admin puede archivar).
```
