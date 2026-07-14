-- ============================================================================
-- Plotline — add template/client columns to the cloud snapshot tables
-- ============================================================================
-- Run this in the Supabase SQL editor AFTER schema.sql and schema_teams.sql.
--
-- proposalTemplates / mtoTemplates / clients have existed in the client-side
-- data model (useAppData) since early on, but were never included in what
-- gets saved to or loaded from the cloud — only projects/sheets/customCats/
-- company were. That meant:
--   1. Templates never actually synced across devices/sessions.
--   2. Worse: any full replace-hydrate (hydrate(snap, false) — a real login,
--      or the stale-session race fixed alongside this migration) would wipe
--      local templates/clients to empty, because the cloud payload never
--      carried them to begin with.
-- This adds the missing columns; app_data.sql's touch-updated_at trigger
-- already fires on any column change, no changes needed there.

alter table public.app_data
  add column if not exists proposal_templates jsonb not null default '{}'::jsonb,
  add column if not exists mto_templates       jsonb not null default '{}'::jsonb,
  add column if not exists clients             jsonb not null default '{}'::jsonb;

alter table public.org_data
  add column if not exists proposal_templates jsonb not null default '{}'::jsonb,
  add column if not exists mto_templates       jsonb not null default '{}'::jsonb,
  add column if not exists clients             jsonb not null default '{}'::jsonb;
