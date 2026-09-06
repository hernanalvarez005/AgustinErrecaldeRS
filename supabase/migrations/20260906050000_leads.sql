-- Leads: raw inbound inquiries (portal, WhatsApp, referral...) that get
-- triaged and converted into a Contact + Búsqueda without duplicating data.
--
-- Design notes (see docs/DATABASE.md, docs/PRODUCT_SPEC.md regla de negocio 6):
-- * `source` reuses the same vocabulary as `contacts.source` /
--   `property_acquisitions.origin` (same "how did this reach us" concept) —
--   same check constraint, not a new enum.
-- * `property_id` is nullable and `on delete set null`: most leads come in
--   asking about a specific listing, but the lead record itself should
--   survive if that property is later deleted (soft-delete via
--   `archived_at` is the norm, so this rarely fires, but a lead is a
--   historical record and shouldn't disappear because of it).
-- * `contact_id`/`search_id` are populated by the conversion flow
--   (`/leads/[id]` → "Convertir"), never by hand. Also `on delete set
--   null` for the same "keep the lead as history" reason. Conversion
--   itself goes through `findPossibleDuplicates` (already built in Fase 1)
--   before creating a new contact, so a converted lead never creates a
--   duplicate contact — see app/(dashboard)/leads/actions.ts.
-- * `assigned_to` is schema-ready for multi-advisor organizations (Fase
--   futura de equipos) but has no UI yet — same "documented deliberately"
--   pattern as the rest of multitenancy (docs/ARCHITECTURE.md).
-- * `notes`/`tasks`/`activities` gain `lead_id` the same way they gained
--   `search_id` in Fase 4 — nullable ALTER TABLE, earlier migrations
--   untouched.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) > 0),
  last_name text,
  phone text,
  email text,
  message text,
  source text check (
    source is null or source in (
      'whatsapp', 'instagram', 'zonaprop', 'argenprop', 'mercadolibre',
      'remax', 'referral', 'sign', 'web', 'own_database', 'other'
    )
  ),
  property_id uuid references public.properties (id) on delete set null,
  status text not null default 'new' check (
    status in (
      'new', 'contacted', 'qualified', 'converted', 'not_interested',
      'unresponsive', 'lost'
    )
  ),
  assigned_to uuid references auth.users (id),
  contact_id uuid references public.contacts (id) on delete set null,
  search_id uuid references public.property_searches (id) on delete set null,
  notes text,
  first_contact_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

comment on table public.leads is
  'A raw inbound inquiry, before it becomes a Contact + Búsqueda. Converting never duplicates an existing contact — see docs/PRODUCT_SPEC.md regla 6.';

create index leads_organization_id_idx on public.leads (organization_id);
create index leads_status_idx on public.leads (status);
create index leads_property_id_idx on public.leads (property_id);
create index leads_contact_id_idx on public.leads (contact_id);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Wire notes/tasks/activities to leads (nullable — see header comment).
-- ---------------------------------------------------------------------------
alter table public.notes add column lead_id uuid references public.leads (id) on delete cascade;
alter table public.tasks add column lead_id uuid references public.leads (id) on delete cascade;
alter table public.activities add column lead_id uuid references public.leads (id) on delete cascade;

create index notes_lead_id_idx on public.notes (lead_id);
create index tasks_lead_id_idx on public.tasks (lead_id);
create index activities_lead_id_idx on public.activities (lead_id);

-- ---------------------------------------------------------------------------
-- lead_overview: same "precompute last interaction / next action" pattern
-- as contact_overview/property_overview/search_overview, to avoid N+1 on
-- the inbox list. security_invoker means it runs as the calling role, so
-- RLS on the underlying tables still applies.
-- ---------------------------------------------------------------------------
create view public.lead_overview
  with (security_invoker = true) as
select
  l.*,
  (
    select max(a.starts_at)
    from public.activities a
    where a.lead_id = l.id
  ) as last_interaction_at,
  (
    select min(t.due_at)
    from public.tasks t
    where t.lead_id = l.id and t.status <> 'completed'
  ) as next_action_at
from public.leads l;

-- ---------------------------------------------------------------------------
-- RLS — same simple "any org member can manage it" policy as Fases 1-4.
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;

create policy "Members can manage leads in their organization"
  on public.leads for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));
