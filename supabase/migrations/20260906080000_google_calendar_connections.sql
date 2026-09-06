-- Fase 9: Google Calendar — OAuth 2.0 + sincronización unilateral
-- CRM → Calendar. Calendar → CRM queda fuera de alcance (docs/ROADMAP.md).
--
-- Design notes (see docs/ARCHITECTURE.md):
-- * Esta tabla es 1:1 con `auth.users`, igual que `profiles` — no lleva
--   `organization_id`. Una conexión de Google es una credencial personal
--   del asesor (su propia cuenta de Google), no un dato de negocio
--   compartido por la organización, así que no sigue el patrón
--   `organization_id in (select private.user_org_ids())` del resto de las
--   tablas: la política de abajo es "solo el dueño de la fila", punto.
-- * `activities.google_event_id` ya existe desde la Fase 1 (columna
--   nullable, sin usar hasta ahora) — no hace falta tocar esa tabla.
-- * Los tokens nunca se exponen al cliente: solo Server Actions/Route
--   Handlers los tocan. No hay cifrado a nivel de columna (pgcrypto)
--   porque introduce su propio problema de dónde guardar la clave —
--   MVP se apoya en RLS (dueño únicamente) + cifrado en reposo de
--   Supabase a nivel de infraestructura. Documentado como límite
--   conocido, no como descuido.

create table public.google_calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_email text,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.google_calendar_connections is
  'One row per advisor who authorized Google Calendar sync. Personal credential, not org-shared business data — RLS is owner-only, unlike every other table here.';

create trigger google_calendar_connections_set_updated_at
  before update on public.google_calendar_connections
  for each row execute function public.set_updated_at();

alter table public.google_calendar_connections enable row level security;

create policy "Users manage their own Google Calendar connection"
  on public.google_calendar_connections for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
