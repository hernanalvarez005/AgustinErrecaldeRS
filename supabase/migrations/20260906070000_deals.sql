-- Fase 6: Operaciones (deals) — comprador + vendedor + propiedad con un
-- pipeline propio (negociación → oferta → reserva → documentación →
-- contrato → escrituración → cerrada/cancelada).
--
-- Design notes (see docs/DATABASE.md):
-- * `deal_type` reutiliza el mismo vocabulario que `properties.operation_type`
--   / `property_searches.operation_type` (sale/rent/temporary_rent) — mismo
--   check constraint, no un enum nuevo.
-- * `buyer_contact_id`/`seller_contact_id` son NOT NULL: a diferencia de una
--   captación (todavía no hay comprador) o una búsqueda (todavía no hay
--   propiedad), una operación solo existe una vez que hay un comprador y un
--   vendedor concretos negociando una propiedad concreta.
-- * `reservation_date`/`contract_date`/`closing_date` son `date` (sin hora)
--   — se muestran con `formatDate` (UTC), nunca `formatDateTime`, por el
--   gotcha de timezones documentado en docs/ARCHITECTURE.md.
-- * `notes`/`tasks`/`activities` ganan `deal_id`, mismo patrón ALTER TABLE
--   nullable que en todas las fases anteriores.
-- * `next_action_at`/`last_interaction_at` se calculan por vista
--   (`deal_overview`, `security_invoker`) desde el primer momento — no se
--   repite el error real de Fase 3 recién corregido en la migración
--   anterior (columna que nadie escribe).

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  buyer_contact_id uuid not null references public.contacts (id),
  seller_contact_id uuid not null references public.contacts (id),
  deal_type text not null default 'sale' check (
    deal_type in ('sale', 'rent', 'temporary_rent')
  ),
  status text not null default 'negotiation' check (
    status in (
      'negotiation', 'offer', 'reservation', 'documentation', 'contract',
      'closing', 'closed', 'cancelled'
    )
  ),
  asking_price numeric(14, 2),
  offer_price numeric(14, 2),
  agreed_price numeric(14, 2),
  currency text check (currency is null or currency in ('ARS', 'USD')),
  reservation_date date,
  contract_date date,
  closing_date date,
  estimated_commission numeric(14, 2),
  commission_currency text check (
    commission_currency is null or commission_currency in ('ARS', 'USD')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

comment on table public.deals is
  'A negotiation between a specific buyer and seller over a specific property, with its own pipeline (negotiation → ... → closed/cancelled).';

create index deals_organization_id_idx on public.deals (organization_id);
create index deals_property_id_idx on public.deals (property_id);
create index deals_buyer_contact_id_idx on public.deals (buyer_contact_id);
create index deals_seller_contact_id_idx on public.deals (seller_contact_id);
create index deals_status_idx on public.deals (status);

create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Wire notes/tasks/activities to deals (nullable — see header comment).
-- ---------------------------------------------------------------------------
alter table public.notes add column deal_id uuid references public.deals (id) on delete cascade;
alter table public.tasks add column deal_id uuid references public.deals (id) on delete cascade;
alter table public.activities add column deal_id uuid references public.deals (id) on delete cascade;

create index notes_deal_id_idx on public.notes (deal_id);
create index tasks_deal_id_idx on public.tasks (deal_id);
create index activities_deal_id_idx on public.activities (deal_id);

-- ---------------------------------------------------------------------------
-- deal_overview: same "precompute last interaction / next action" pattern
-- as every other *_overview view, to avoid N+1 on the pipeline list.
-- ---------------------------------------------------------------------------
create view public.deal_overview
  with (security_invoker = true) as
select
  d.*,
  (
    select max(a.starts_at)
    from public.activities a
    where a.deal_id = d.id
  ) as last_interaction_at,
  (
    select min(t.due_at)
    from public.tasks t
    where t.deal_id = d.id and t.status <> 'completed'
  ) as next_action_at
from public.deals d;

-- ---------------------------------------------------------------------------
-- RLS — same simple "any org member can manage it" policy as Fases 1-5.
-- ---------------------------------------------------------------------------
alter table public.deals enable row level security;

create policy "Members can manage deals in their organization"
  on public.deals for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));
