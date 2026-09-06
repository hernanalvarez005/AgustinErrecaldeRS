-- V2 bloque D (Visitas): feedback post-visita.
--
-- Design notes (see docs/DATABASE.md, docs/V2_EVOLUTION_PLAN.md):
-- * No se crea una tabla `visits` — `activities` (Fase 1) ya representa
--   correctamente el evento (`type in ('property_visit',
--   'acquisition_visit')`, sincroniza con Google Calendar desde la Fase
--   9). Esta tabla agrega SOLO la estructura específica de feedback que
--   `activities` no tiene y no debería tener (no llenar `activities` de
--   columnas que solo aplican a un subconjunto de sus tipos).
-- * `unique (activity_id)`: una visita tiene a lo sumo un feedback — así
--   "cargar o editar" es un simple upsert por `activity_id`, sin lógica
--   de "ya existe, hago update en vez de insert" en el código de la app.
create table public.visit_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  interest_level text check (
    interest_level is null or interest_level in (
      'very_interested', 'interested', 'unsure', 'discarded'
    )
  ),
  positive_feedback text,
  negative_feedback text,
  price_perception text check (
    price_perception is null or price_perception in ('low', 'fair', 'high')
  ),
  wants_to_proceed text check (
    wants_to_proceed is null or wants_to_proceed in ('yes', 'no', 'thinking')
  ),
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id)
);

comment on table public.visit_feedback is
  'Post-visit feedback (interest level, price perception, wants to proceed) — one row per activity, added via "Finalizar visita". Never duplicates activities columns that only apply to visits.';

create index visit_feedback_activity_id_idx on public.visit_feedback (activity_id);

create trigger visit_feedback_set_updated_at
  before update on public.visit_feedback
  for each row execute function public.set_updated_at();

alter table public.visit_feedback enable row level security;

create policy "Members can manage visit feedback in their organization"
  on public.visit_feedback for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));
