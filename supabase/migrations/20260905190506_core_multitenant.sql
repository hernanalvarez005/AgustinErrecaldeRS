-- Core multitenant foundation: organizations, profiles, memberships.
--
-- Design notes (see docs/ARCHITECTURE.md for the full rationale):
-- * Every business table will carry an `organization_id` FK so the product can grow
--   from a single advisor into a multi-advisor / multi-team SaaS without a schema
--   rewrite. This migration only lays down the tenancy primitives.
-- * `organizations` / `memberships` are never written to directly by clients.
--   All writes go through SECURITY DEFINER RPCs (see `create_organization` below)
--   so RLS cannot be bypassed by inserting a membership into an org you don't own.
-- * `private.user_org_ids()` is a SECURITY DEFINER helper other migrations will
--   reuse in RLS policies (`organization_id in (select private.user_org_ids())`)
--   to avoid repeating a subquery on every table and to sidestep RLS recursion.

create extension if not exists pgcrypto;

-- Schema for internal helpers that must never be exposed through PostgREST.
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- updated_at helper trigger, reused by every table that has an updated_at column.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  main_area text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is
  'Tenant boundary. Every business record belongs to exactly one organization.';

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users, holds app-level user data)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'App-level profile data for an auth.users row. Created automatically on signup.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- memberships (join table between auth users and organizations)
-- ---------------------------------------------------------------------------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

comment on table public.memberships is
  'Which users belong to which organizations, and with what role. MVP has one owner per org.';

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_organization_id_idx on public.memberships (organization_id);

-- ---------------------------------------------------------------------------
-- RLS helper: the set of organization_ids the current JWT's user belongs to.
-- SECURITY DEFINER + table ownership means this bypasses RLS on `memberships`
-- itself, which is what lets other tables' policies use it without recursion.
-- ---------------------------------------------------------------------------
create or replace function private.user_org_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id
  from public.memberships
  where user_id = auth.uid();
$$;

revoke all on function private.user_org_ids() from public;
grant execute on function private.user_org_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

-- organizations: members can read their own org(s); owners/admins can update it.
-- No direct INSERT/DELETE policy — creation only happens through
-- create_organization() below, which runs as SECURITY DEFINER.
create policy "Members can view their organizations"
  on public.organizations for select
  to authenticated
  using (id in (select private.user_org_ids()));

create policy "Owners and admins can update their organization"
  on public.organizations for update
  to authenticated
  using (
    id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  )
  with check (
    id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- profiles: a user can only ever see/edit their own profile row.
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- memberships: a user can see memberships in organizations they belong to
-- (needed later to list teammates). No direct INSERT/UPDATE/DELETE policy —
-- membership changes go through SECURITY DEFINER RPCs.
create policy "Members can view memberships in their organizations"
  on public.memberships for select
  to authenticated
  using (organization_id in (select private.user_org_ids()));

-- ---------------------------------------------------------------------------
-- Onboarding RPC: creates an organization and the caller's owner membership
-- atomically. This is the only way rows land in organizations/memberships
-- from client code, which keeps the "no self-service join" invariant intact.
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_timezone text default 'America/Argentina/Buenos_Aires',
  p_currency text default 'ARS',
  p_main_area text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, slug, timezone, currency, main_area)
  values (p_name, p_slug, p_timezone, p_currency, p_main_area)
  returning id into v_org_id;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

  update public.profiles
  set
    first_name = coalesce(p_first_name, first_name),
    last_name = coalesce(p_last_name, last_name),
    phone = coalesce(p_phone, phone)
  where id = auth.uid();

  return v_org_id;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_organization(text, text, text, text, text, text, text, text) to authenticated;
