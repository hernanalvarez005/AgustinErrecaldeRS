-- V2 bloque C (Ficha de propiedad): historial de precios.
--
-- Design notes (see docs/DATABASE.md, docs/V2_EVOLUTION_PLAN.md):
-- * No es lo mismo que `valuations` (Fase 3) — esa tabla es el análisis de
--   tasación PREVIO a publicar (estimado min/max/recomendado), esta es el
--   registro real de cambios al `properties.price` que efectivamente se
--   publicó. Confirmado por auditoría: no existía ninguna estructura que
--   cubriera esto.
-- * Regla del spec: "no depender de que el frontend recuerde crear el
--   historial" — se implementa con un trigger, no con código de la app.
--   Cualquier camino de escritura futuro (import masivo, otra pantalla)
--   queda cubierto automáticamente.
-- * No duplica eventos: el trigger solo dispara `when (old.price is
--   distinct from new.price)` — un update que no toca el precio, o que lo
--   reescribe con el mismo valor, no genera fila.
-- * Sin política de insert/update/delete para `authenticated`: la única
--   forma de escribir es a través del trigger (`security definer`, corre
--   con los privilegios de quien definió la función, no de quien hizo el
--   update) — mismo patrón que `create_organization()`/`handle_new_user()`
--   de la Fase 0.

create table public.property_price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  previous_price numeric(14, 2),
  new_price numeric(14, 2),
  currency text check (currency is null or currency in ('ARS', 'USD')),
  change_reason text,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now()
);

comment on table public.property_price_history is
  'Automatic audit trail of properties.price changes — one row per change, written only by the trigger below, never directly by application code.';

create index property_price_history_property_id_idx
  on public.property_price_history (property_id);

alter table public.property_price_history enable row level security;

create policy "Members can view price history in their organization"
  on public.property_price_history for select
  to authenticated
  using (organization_id in (select private.user_org_ids()));

create or replace function public.log_property_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.property_price_history (
    organization_id, property_id, previous_price, new_price, currency, changed_by
  ) values (
    new.organization_id, new.id, old.price, new.price, new.currency, auth.uid()
  );
  return new;
end;
$$;

create trigger properties_log_price_change
  after update on public.properties
  for each row
  when (old.price is distinct from new.price)
  execute function public.log_property_price_change();
