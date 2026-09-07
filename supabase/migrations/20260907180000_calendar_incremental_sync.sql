-- V2.2 Bloque 6: Google → CRM incremental sync.
--
-- Adds the bookkeeping needed to pull changes FROM Google Calendar INTO
-- `activities`, without touching the existing CRM → Google path
-- (lib/google/calendar.ts's create/update/delete functions, already used
-- by app/(dashboard)/calendar/actions.ts — untouched by this migration).
--
-- Design notes:
-- * `google_calendar_connections.sync_token`/`last_synced_at`: Google's
--   incremental-sync mechanism (events.list with `syncToken`) needs a place
--   to persist the token between runs. Lives on the connection row itself
--   (1:1 with the advisor's Google account), not a separate table — the
--   token is meaningless without the connection it came from.
-- * `activities.source`: distinguishes a CRM-authored row (`crm`, the
--   default — everything created through this app's own forms, matching
--   all existing rows) from one that was imported wholesale from a Google
--   event the advisor created directly on Google (`google_calendar`).
--   Spec V2.2 punto 25 is explicit that an imported event must never
--   auto-become a CRM contact/lead/property/task — it's a plain activities
--   row with every linking FK (`contact_id`/`property_id`/etc., already on
--   this table since Fases 2-6) left null until the advisor explicitly
--   "Vincula" it (Bloque 8, reuses these same columns — no new ones
--   needed for linking).
-- * `activities.google_updated_at`: the last Google `updated` timestamp
--   applied to this row. Read before writing an incoming change so a
--   re-fetch of an event we already applied (e.g. our own CRM→Google push
--   round-tripping back on the next incremental sync) is a no-op instead
--   of overwriting the row with the same data again — a lightweight guard
--   against the sync-loop concern spec punto 29 raises for Bloque 8,
--   cheap enough to add now rather than bolt on later.

alter table public.google_calendar_connections
  add column sync_token text,
  add column last_synced_at timestamptz;

alter table public.activities
  add column source text not null default 'crm'
    check (source in ('crm', 'google_calendar')),
  add column google_updated_at timestamptz;

comment on column public.activities.source is
  'crm = created through this app; google_calendar = imported from a Google-side event the advisor never logged here.';
comment on column public.activities.google_updated_at is
  'Last Google event `updated` timestamp applied to this row — lets incremental sync skip a change it already wrote.';

-- Sync needs to look up "do we already have a row for this Google event id
-- in this organization" on every incoming event — index it (nullable column,
-- most rows never touch Google, so a partial index only over the ones that do).
create index activities_google_event_id_idx
  on public.activities (google_event_id)
  where google_event_id is not null;
