-- Property searches (búsquedas inmobiliarias) — the buyer/tenant pipeline.
--
-- Design notes (see docs/DATABASE.md and docs/ARCHITECTURE.md):
-- * A search belongs to a `contact`, not a `property` — a contact can have
--   several searches (simultaneous or historical), and a search doesn't
--   point at one property, it's the criteria used to find one. This mirrors
--   the modeling question already answered in Fase 1/2 for roles/owners.
-- * `property_types`/`cities`/`neighborhoods` are arrays — a search can
--   span more than one type or zone. `property_types` is constrained to the
--   same vocabulary as `properties.property_type` via a `<@` check.
-- * `search_id` gets added to notes/tasks/activities the same way
--   `acquisition_id` was in Fase 3 — nullable ALTER TABLE, prior migrations
--   untouched.
-- * `search_overview` follows the contact_overview/property_overview
--   pattern: contact name + last interaction + next action precomputed in
--   one query for the list page.

create table public.property_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,

  operation_type text not null default 'sale' check (operation_type in ('sale', 'rent', 'temporary_rent')),
  property_types text[] not null default '{}' check (
    property_types <@ array['apartment', 'house', 'ph', 'land', 'office', 'commercial', 'warehouse', 'other']
  ),

  min_price numeric(14, 2),
  max_price numeric(14, 2),
  currency text check (currency is null or currency in ('ARS', 'USD')),

  cities text[] not null default '{}',
  neighborhoods text[] not null default '{}',

  min_bedrooms smallint,
  max_bedrooms smallint,
  min_total_area numeric(10, 2),
  min_covered_area numeric(10, 2),

  requires_garage boolean not null default false,
  requires_balcony boolean not null default false,
  requires_patio boolean not null default false,
  requires_elevator boolean not null default false,

  must_have text,
  nice_to_have text,

  objective text check (
    objective is null or objective in (
      'primary_residence', 'investment', 'traditional_rent', 'temporary_rent',
      'relocation', 'liquidity_need', 'inheritance', 'separation',
      'city_change', 'portfolio_expansion', 'other'
    )
  ),
  urgency text check (urgency is null or urgency in ('high', 'medium', 'low')),
  expected_decision_date date,
  financing_required boolean not null default false,

  status text not null default 'new' check (
    status in (
      'new', 'qualified', 'searching', 'options_sent', 'visiting',
      'negotiating', 'reserved', 'closed', 'paused', 'lost'
    )
  ),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint property_searches_price_order check (min_price is null or max_price is null or min_price <= max_price),
  constraint property_searches_bedrooms_order check (min_bedrooms is null or max_bedrooms is null or min_bedrooms <= max_bedrooms)
);

comment on table public.property_searches is
  'A buyer/tenant search: what a contact is looking for. Belongs to the contact, not to any one property.';

create index property_searches_organization_id_idx on public.property_searches (organization_id);
create index property_searches_contact_id_idx on public.property_searches (contact_id);
create index property_searches_status_idx on public.property_searches (status);

create trigger property_searches_set_updated_at
  before update on public.property_searches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Wire notes/tasks/activities to searches (nullable — see header comment).
-- ---------------------------------------------------------------------------
alter table public.notes add column search_id uuid references public.property_searches (id) on delete cascade;
alter table public.tasks add column search_id uuid references public.property_searches (id) on delete cascade;
alter table public.activities add column search_id uuid references public.property_searches (id) on delete cascade;

create index notes_search_id_idx on public.notes (search_id);
create index tasks_search_id_idx on public.tasks (search_id);
create index activities_search_id_idx on public.activities (search_id);

-- ---------------------------------------------------------------------------
-- RLS — same simple "any org member can manage it" policy as Fases 1-3.
-- ---------------------------------------------------------------------------
alter table public.property_searches enable row level security;

create policy "Members can manage searches in their organization"
  on public.property_searches for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));

-- ---------------------------------------------------------------------------
-- search_overview: contact name + last interaction + next action
-- precomputed in one query, same pattern as contact_overview/property_overview.
-- ---------------------------------------------------------------------------
create view public.search_overview
with (security_invoker = true) as
select
  s.*,
  c.first_name as contact_first_name,
  c.last_name as contact_last_name,
  (
    select max(a.starts_at)
    from public.activities a
    where a.search_id = s.id and a.status = 'completed'
  ) as last_interaction_at,
  (
    select min(t.due_at)
    from public.tasks t
    where t.search_id = s.id and t.status in ('pending', 'in_progress')
  ) as next_action_at
from public.property_searches s
join public.contacts c on c.id = s.contact_id;

comment on view public.search_overview is
  'Read model for the searches list: contact name + last interaction + next action in one query. security_invoker so RLS still applies.';
