-- Acquisitions (captaciones) and valuations (tasaciones).
--
-- Design notes (see docs/DATABASE.md):
-- * `property_acquisitions.primary_owner_contact_id` duplicates information
--   that also lives in `property_owners` (Fase 2). This is deliberate
--   denormalization: the Kanban card needs "who am I negotiating this
--   captación with" in one query without joining property_owners, and that
--   contact isn't always the same as "the" primary owner if a property ends
--   up with several (the negotiation contact is fixed at acquisition
--   creation time). Documented here per docs/DATABASE.md section 68.
-- * `notes`/`tasks`/`activities` gain `acquisition_id` the same way they
--   gained `property_id` in Fase 2 — nullable ALTER TABLE, Fase 1 migration
--   untouched.
-- * `origin` reuses the same source vocabulary as `contacts.source` (same
--   "how did this reach us" concept), so it's the same check constraint
--   rather than a new enum.

create table public.property_acquisitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  primary_owner_contact_id uuid not null references public.contacts (id),
  status text not null default 'new_lead' check (
    status in (
      'new_lead', 'contacted', 'meeting_scheduled', 'meeting_completed',
      'valuation', 'proposal_sent', 'follow_up', 'won', 'lost'
    )
  ),
  origin text check (
    origin is null or origin in (
      'whatsapp', 'instagram', 'zonaprop', 'argenprop', 'mercadolibre',
      'remax', 'referral', 'sign', 'web', 'own_database', 'other'
    )
  ),
  estimated_value numeric(14, 2),
  proposed_listing_price numeric(14, 2),
  valuation_date date,
  meeting_date timestamptz,
  next_action_at timestamptz,
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.property_acquisitions is
  'The commercial process of getting a property listed, from first contact with the owner to won/lost. One property could in theory have more than one acquisition over time (re-listed later).';

create index property_acquisitions_organization_id_idx on public.property_acquisitions (organization_id);
create index property_acquisitions_property_id_idx on public.property_acquisitions (property_id);
create index property_acquisitions_status_idx on public.property_acquisitions (status);

create trigger property_acquisitions_set_updated_at
  before update on public.property_acquisitions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- valuations
-- ---------------------------------------------------------------------------
create table public.valuations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  acquisition_id uuid references public.property_acquisitions (id) on delete cascade,
  estimated_min_value numeric(14, 2),
  estimated_value numeric(14, 2),
  estimated_max_value numeric(14, 2),
  currency text check (currency is null or currency in ('ARS', 'USD')),
  recommended_listing_price numeric(14, 2),
  valuation_date date not null default current_date,
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint valuations_min_max_order check (
    estimated_min_value is null or estimated_max_value is null or estimated_min_value <= estimated_max_value
  )
);

comment on table public.valuations is
  'A recorded valuation analysis for a property. A property/acquisition can have several over time.';

create index valuations_property_id_idx on public.valuations (property_id);
create index valuations_acquisition_id_idx on public.valuations (acquisition_id);

-- ---------------------------------------------------------------------------
-- Wire notes/tasks/activities to acquisitions (nullable — see header comment).
-- ---------------------------------------------------------------------------
alter table public.notes add column acquisition_id uuid references public.property_acquisitions (id) on delete cascade;
alter table public.tasks add column acquisition_id uuid references public.property_acquisitions (id) on delete cascade;
alter table public.activities add column acquisition_id uuid references public.property_acquisitions (id) on delete cascade;

create index notes_acquisition_id_idx on public.notes (acquisition_id);
create index tasks_acquisition_id_idx on public.tasks (acquisition_id);
create index activities_acquisition_id_idx on public.activities (acquisition_id);

-- ---------------------------------------------------------------------------
-- RLS — same simple "any org member can manage it" policy as Fases 1-2.
-- ---------------------------------------------------------------------------
alter table public.property_acquisitions enable row level security;
alter table public.valuations enable row level security;

create policy "Members can manage acquisitions in their organization"
  on public.property_acquisitions for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));

create policy "Members can manage valuations in their organization"
  on public.valuations for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));
