-- CRM Core: contacts, roles, notes, tasks, activities.
--
-- Design notes (see docs/DATABASE.md and docs/ARCHITECTURE.md):
-- * `notes`/`tasks`/`activities` only get a `contact_id` context column in
--   this migration. `property_id`, `deal_id`, `search_id`, `acquisition_id`,
--   `lead_id` are added as nullable columns in the migrations that introduce
--   those tables (Fases 2-6), per the "one migration per phase, never modify
--   an already-applied migration" rule.
-- * `contact_roles` has no `organization_id` of its own — it's a tight
--   1-parent junction on `contacts`, so its RLS policies check membership
--   through `contacts` via EXISTS instead of duplicating the column.
-- * `contact_overview` is a `security_invoker` view that precomputes
--   "last interaction" / "next action" / role list per contact in one query,
--   instead of the app doing one query per row (N+1) for the contacts list.
--   security_invoker means it runs as the calling role, so RLS on the
--   underlying tables still applies — the view itself grants no bypass.

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) > 0),
  last_name text not null check (char_length(btrim(last_name)) > 0),
  phone text,
  whatsapp text,
  email text,
  dni text,
  birth_date date,
  address text,
  profession text,
  source text check (
    source is null or source in (
      'whatsapp', 'instagram', 'zonaprop', 'argenprop', 'mercadolibre',
      'remax', 'referral', 'sign', 'web', 'own_database', 'other'
    )
  ),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

comment on table public.contacts is
  'A person the advisor deals with. Roles (buyer, owner, ...) live in contact_roles — a contact can have several at once.';

create index contacts_organization_id_idx on public.contacts (organization_id);
create index contacts_phone_idx on public.contacts (phone);
create index contacts_email_idx on public.contacts (email);
create index contacts_dni_idx on public.contacts (dni);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- contact_roles
-- ---------------------------------------------------------------------------
create table public.contact_roles (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  role text not null check (
    role in (
      'buyer', 'seller', 'owner', 'investor', 'tenant', 'landlord',
      'referrer', 'past_client', 'other'
    )
  ),
  created_at timestamptz not null default now(),
  unique (contact_id, role)
);

comment on table public.contact_roles is
  'The N roles a contact currently has. Deliberately not a single client_type column — see docs/PRODUCT_SPEC.md.';

create index contact_roles_contact_id_idx on public.contact_roles (contact_id);

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0),
  contact_id uuid references public.contacts (id) on delete cascade,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notes is
  'Freeform notes. Every context FK is nullable — a note attaches to whatever it is about.';

create index notes_organization_id_idx on public.notes (organization_id);
create index notes_contact_id_idx on public.notes (contact_id);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  description text,
  contact_id uuid references public.contacts (id) on delete cascade,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid references auth.users (id) default auth.uid(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

comment on table public.tasks is
  'The next action for a contact/opportunity. "No active opportunity without a next action" is a UI rule, not a DB constraint.';

create index tasks_organization_id_idx on public.tasks (organization_id);
create index tasks_contact_id_idx on public.tasks (contact_id);
create index tasks_due_at_idx on public.tasks (due_at);
create index tasks_status_idx on public.tasks (status);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type text not null check (
    type in (
      'call', 'whatsapp', 'email', 'meeting', 'virtual_meeting',
      'property_visit', 'acquisition_visit', 'valuation', 'notary_meeting',
      'reservation', 'contract_signing', 'closing', 'follow_up', 'other'
    )
  ),
  title text,
  description text,
  contact_id uuid references public.contacts (id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'completed' check (status in ('scheduled', 'completed', 'cancelled')),
  location text,
  meeting_url text,
  google_event_id text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_starts_before_ends check (ends_at is null or starts_at <= ends_at)
);

comment on table public.activities is
  'Anything that happened or is scheduled: calls, visits, meetings... Base of every entity timeline.';

create index activities_organization_id_idx on public.activities (organization_id);
create index activities_contact_id_idx on public.activities (contact_id);
create index activities_starts_at_idx on public.activities (starts_at);

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — Fase 1 keeps it simple: any member of the organization can read and
-- write its contacts/notes/tasks/activities. Per-row ownership (e.g. "only
-- the assignee can complete this task") is deferred until there's more than
-- one advisor per org and it actually matters — see docs/ARCHITECTURE.md.
-- ---------------------------------------------------------------------------
alter table public.contacts enable row level security;
alter table public.contact_roles enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;

create policy "Members can manage contacts in their organization"
  on public.contacts for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));

create policy "Members can manage contact roles in their organization"
  on public.contact_roles for all
  to authenticated
  using (
    exists (
      select 1 from public.contacts c
      where c.id = contact_roles.contact_id
        and c.organization_id in (select private.user_org_ids())
    )
  )
  with check (
    exists (
      select 1 from public.contacts c
      where c.id = contact_roles.contact_id
        and c.organization_id in (select private.user_org_ids())
    )
  );

create policy "Members can manage notes in their organization"
  on public.notes for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));

create policy "Members can manage tasks in their organization"
  on public.tasks for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));

create policy "Members can manage activities in their organization"
  on public.activities for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));

-- ---------------------------------------------------------------------------
-- contact_overview: one query for the contacts list instead of N+1.
-- ---------------------------------------------------------------------------
create view public.contact_overview
with (security_invoker = true) as
select
  c.*,
  (
    select array_agg(r.role order by r.role)
    from public.contact_roles r
    where r.contact_id = c.id
  ) as roles,
  (
    select max(a.starts_at)
    from public.activities a
    where a.contact_id = c.id and a.status = 'completed'
  ) as last_interaction_at,
  (
    select min(t.due_at)
    from public.tasks t
    where t.contact_id = c.id and t.status in ('pending', 'in_progress')
  ) as next_action_at
from public.contacts c
where c.archived_at is null;

comment on view public.contact_overview is
  'Read model for the contacts list: roles + last interaction + next action precomputed in one query. security_invoker so RLS on contacts/contact_roles/activities/tasks still applies.';
