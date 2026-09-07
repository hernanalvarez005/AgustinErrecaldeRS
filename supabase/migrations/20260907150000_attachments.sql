-- V2.2 bloque 2 (Storage + attachments): documentación adjunta a clientes y
-- propiedades.
--
-- Design notes (ver docs/V2_2_EVOLUTION_PLAN.md):
-- * FKs explícitas nullable (`contact_id`, `property_id`), no un
--   `entity_type`/`entity_id` polimórfico — mismo patrón ya usado por
--   `notes`/`tasks`/`activities` desde la Fase 1 para "esto pertenece a
--   uno de varios contextos posibles" (ver 20260905193955_crm_core.sql).
--   La spec de V2.2 deja esta alternativa explícitamente a criterio de la
--   arquitectura existente, y acá ya está resuelto — reutilizar el mismo
--   criterio en vez de introducir un segundo patrón para el mismo
--   problema. Extensible a otras entidades (búsquedas, operaciones) con
--   una migración nueva que agregue la columna correspondiente, el día
--   que se pida.
-- * `file_size` tiene un check de <= 15 MB acá Y se valida en
--   `lib/validations/attachment.ts` en la app — el límite vive en un solo
--   lugar conceptual (15 MB, documentado en ambos) pero se aplica en las
--   dos capas: la app para dar feedback inmediato al usuario, la base
--   para que ningún camino de escritura (ni un bug futuro) pueda saltarse
--   el límite.
-- * `storage_path` no incluye `file_name` tal cual el usuario lo escribió
--   — un prefijo `<organization_id>/...` (para que la política de Storage
--   de más abajo pueda leerlo con `storage.foldername`) más un uuid, con
--   el nombre original solo como sufijo legible. El nombre "real" para
--   mostrar/renombrar vive en `file_name`, nunca se deriva del path.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  property_id uuid references public.properties (id) on delete cascade,
  file_name text not null check (char_length(btrim(file_name)) > 0),
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 15728640), -- 15 MB
  category text,
  description text,
  uploaded_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attachments_exactly_one_entity check (
    (contact_id is not null)::int + (property_id is not null)::int = 1
  )
);

comment on table public.attachments is
  'Files attached to a contact or a property (exactly one, never both/neither) — DNI, planos, escrituras, tasaciones, fotos, etc. The actual bytes live in Supabase Storage (bucket "attachments", private); this table is the metadata + access-control boundary.';

create index attachments_organization_id_idx on public.attachments (organization_id);
create index attachments_contact_id_idx on public.attachments (contact_id);
create index attachments_property_id_idx on public.attachments (property_id);

create trigger attachments_set_updated_at
  before update on public.attachments
  for each row execute function public.set_updated_at();

alter table public.attachments enable row level security;

create policy "Members can manage attachments in their organization"
  on public.attachments for all
  to authenticated
  using (organization_id in (select private.user_org_ids()))
  with check (organization_id in (select private.user_org_ids()));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado + políticas por organización
-- ---------------------------------------------------------------------------
-- Privado (`public = false`) a propósito — ver punto 5/6 de la spec V2.2:
-- nunca servir documentación potencialmente sensible (DNI, escrituras) por
-- una URL pública permanente. Toda lectura pasa por una signed URL de
-- vida corta generada server-side (lib/actions/attachments.ts), nunca por
-- la URL pública del bucket.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 15728640)
on conflict (id) do nothing;

-- Cada objeto se sube con el patrón de path
-- `<organization_id>/<contact|property>/<entity_id>/<uuid>-<nombre>` — el
-- primer segmento del path (`storage.foldername(name)[1]`) es siempre el
-- `organization_id`, así que estas políticas son el mismo criterio de
-- "organization_id in user_org_ids()" que usa el resto del esquema, solo
-- que leído del path en vez de una columna.
create policy "Org members can read their org's attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1]::uuid in (select private.user_org_ids())
  );

create policy "Org members can upload attachments to their organization"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1]::uuid in (select private.user_org_ids())
  );

create policy "Org members can delete their org's attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1]::uuid in (select private.user_org_ids())
  );
