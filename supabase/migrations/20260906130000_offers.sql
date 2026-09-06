-- V2 bloque E (Ofertas): interés → visita → oferta → operación.
--
-- Design notes (see docs/DATABASE.md, docs/V2_EVOLUTION_PLAN.md):
-- * `deals` (Fase 6) sigue siendo la operación en curso — esta tabla es
--   lo que pasa ANTES de que exista una operación: una propuesta de
--   precio sobre una propiedad concreta. `deal_id` es nullable y se
--   completa recién cuando la oferta se acepta y se crea (o se vincula)
--   la operación.
-- * Las contraofertas NUNCA sobrescriben el monto de una oferta anterior
--   — cada una es una fila nueva, encadenada por `parent_offer_id`. El
--   historial completo de la negociación queda intacto.
-- * `contact_id` es la contraparte con la que se negocia (normalmente el
--   comprador interesado) — se mantiene igual a lo largo de toda la
--   cadena de una misma negociación; no se modela por separado "de qué
--   lado" vino cada contraoferta (dato que el asesor ya sabe leyendo
--   fecha/monto, y agregar una columna para esto sin un caso de uso que
--   lo pida sería anticipar de más).
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  contact_id uuid not null references public.contacts (id),
  deal_id uuid references public.deals (id) on delete set null,
  amount numeric(14, 2) not null,
  currency text not null check (currency in ('ARS', 'USD')),
  status text not null default 'pending' check (
    status in (
      'pending', 'accepted', 'rejected', 'counter_offered', 'withdrawn', 'expired'
    )
  ),
  conditions text,
  expiration_date date,
  parent_offer_id uuid references public.offers (id) on delete set null,
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.offers is
  'A price proposal on a property, before (or instead of) a deal existing. Counteroffers are new rows chained by parent_offer_id — amounts are never overwritten.';

create index offers_organization_id_idx on public.offers (organization_id);
create index offers_property_id_idx on public.offers (property_id);
create index offers_contact_id_idx on public.offers (contact_id);
create index offers_deal_id_idx on public.offers (deal_id);
create index offers_status_idx on public.offers (status);
create index offers_parent_offer_id_idx on public.offers (parent_offer_id);

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

alter table public.offers enable row level security;

create policy "Members can manage offers in their organization"
  on public.offers for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));
