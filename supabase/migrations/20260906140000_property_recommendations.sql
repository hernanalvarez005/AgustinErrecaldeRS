-- V2 bloque G (Matching): registro de propiedades efectivamente
-- presentadas a un cliente, distinto de un "match" calculado al vuelo
-- (Fase 11, lib/matching/score.ts — que no persiste nada).
--
-- Design notes (see docs/DATABASE.md, docs/V2_EVOLUTION_PLAN.md):
-- * `search_id` + `contact_id` juntos son deliberadamente redundantes
--   (`contact_id` ya se puede derivar de `search_id`) — igual que otras
--   tablas de este proyecto que denormalizan un dato accesible con un
--   join para no forzar ese join en cada consulta desde la ficha de
--   cliente.
-- * Sin `unique (property_id, search_id)`: volver a presentar la misma
--   propiedad más adelante (por ejemplo, después de una baja de precio)
--   es una acción real y legítima, no un error a impedir.
create table public.property_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  search_id uuid not null references public.property_searches (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  sent_at timestamptz not null default now(),
  channel text not null default 'whatsapp' check (
    channel in ('whatsapp', 'email', 'in_person', 'other')
  ),
  status text not null default 'sent' check (
    status in ('sent', 'interested', 'not_interested', 'visit_scheduled')
  ),
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.property_recommendations is
  'A property actually sent to a client for a given search — distinct from a Fase 11 match score, which is computed on the fly and never persisted.';

create index property_recommendations_property_id_idx
  on public.property_recommendations (property_id);
create index property_recommendations_search_id_idx
  on public.property_recommendations (search_id);
create index property_recommendations_contact_id_idx
  on public.property_recommendations (contact_id);
create index property_recommendations_status_idx
  on public.property_recommendations (status);

create trigger property_recommendations_set_updated_at
  before update on public.property_recommendations
  for each row execute function public.set_updated_at();

alter table public.property_recommendations enable row level security;

create policy "Members can manage recommendations in their organization"
  on public.property_recommendations for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));
