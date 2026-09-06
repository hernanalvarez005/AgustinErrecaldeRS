-- Properties: properties, property_owners, and wiring notes/tasks/activities
-- to a property the same way Fase 1 wired them to a contact.
--
-- Design notes (see docs/DATABASE.md):
-- * `property_owners` has no `organization_id` of its own — same reasoning
--   as `contact_roles`: a tight junction on `properties`, RLS via EXISTS.
-- * `property_overview` follows the same security_invoker pattern as
--   `contact_overview`, precomputing a display name for the primary owner
--   so the list page doesn't do one query per row.
-- * `notes`/`tasks`/`activities` only gained `contact_id` in Fase 1. This
--   migration adds `property_id` as a new nullable column — never touching
--   the Fase 1 migration that already shipped.

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  property_type text not null check (
    property_type in ('apartment', 'house', 'ph', 'land', 'office', 'commercial', 'warehouse', 'other')
  ),
  operation_type text not null check (operation_type in ('sale', 'rent', 'temporary_rent')),

  street text,
  street_number text,
  floor text,
  unit text,
  city text,
  neighborhood text,
  province text,
  country text not null default 'Argentina',
  latitude double precision,
  longitude double precision,

  price numeric(14, 2),
  currency text check (currency is null or currency in ('ARS', 'USD')),

  bedrooms smallint,
  bathrooms smallint,
  garage_spaces smallint,
  total_area numeric(10, 2),
  covered_area numeric(10, 2),
  uncovered_area numeric(10, 2),
  lot_area numeric(10, 2),

  expenses numeric(12, 2),
  age_years smallint,

  description text,
  internal_notes text,

  status text not null default 'draft' check (
    status in ('draft', 'valuation', 'capturing', 'active', 'reserved', 'sold', 'rented', 'paused', 'lost', 'archived')
  ),

  publication_url text,
  external_reference text,

  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),

  constraint properties_price_requires_currency check (price is null or currency is not null)
);

comment on table public.properties is
  'A property being valued, captured, or actively marketed. Ownership lives in property_owners — a property can have several owners.';

create index properties_organization_id_idx on public.properties (organization_id);
create index properties_status_idx on public.properties (status);
create index properties_operation_type_idx on public.properties (operation_type);
create index properties_city_idx on public.properties (city);

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- property_owners
-- ---------------------------------------------------------------------------
create table public.property_owners (
  property_id uuid not null references public.properties (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  ownership_percentage numeric(5, 2) check (
    ownership_percentage is null or (ownership_percentage > 0 and ownership_percentage <= 100)
  ),
  is_primary_contact boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  primary key (property_id, contact_id)
);

comment on table public.property_owners is
  'Which contacts own a property, and in what share. A property can have multiple owners.';

create index property_owners_contact_id_idx on public.property_owners (contact_id);

-- ---------------------------------------------------------------------------
-- Wire notes/tasks/activities to properties (nullable — see header comment).
-- ---------------------------------------------------------------------------
alter table public.notes add column property_id uuid references public.properties (id) on delete cascade;
alter table public.tasks add column property_id uuid references public.properties (id) on delete cascade;
alter table public.activities add column property_id uuid references public.properties (id) on delete cascade;

create index notes_property_id_idx on public.notes (property_id);
create index tasks_property_id_idx on public.tasks (property_id);
create index activities_property_id_idx on public.activities (property_id);

-- ---------------------------------------------------------------------------
-- RLS — same simple "any org member can manage it" policy as Fase 1.
-- ---------------------------------------------------------------------------
alter table public.properties enable row level security;
alter table public.property_owners enable row level security;

create policy "Members can manage properties in their organization"
  on public.properties for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));

create policy "Members can manage property owners in their organization"
  on public.property_owners for all
  to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_owners.property_id
        and p.organization_id in (select private.user_org_ids())
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_owners.property_id
        and p.organization_id in (select private.user_org_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- property_overview: primary owner name precomputed, same idea as
-- contact_overview, to avoid an N+1 on the properties list.
-- ---------------------------------------------------------------------------
create view public.property_overview
with (security_invoker = true) as
select
  p.*,
  (
    select c.first_name || ' ' || c.last_name
    from public.property_owners po
    join public.contacts c on c.id = po.contact_id
    where po.property_id = p.id
    order by po.is_primary_contact desc, po.created_at asc
    limit 1
  ) as primary_owner_name
from public.properties p
where p.archived_at is null;

comment on view public.property_overview is
  'Read model for the properties list: primary owner name precomputed in one query. security_invoker so RLS still applies.';
