-- ============================================================================
-- Plotline — add template/client columns to the cloud snapshot tables
-- ============================================================================
-- Run this in the Supabase SQL editor AFTER schema.sql and schema_teams.sql.
--
-- proposalTemplates / mtoTemplates / clients have existed in the client-side
-- data model (useAppData) since early on, but were never included in what
-- gets saved to or loaded from the cloud — only projects/sheets/customCats
-- were. That meant:
--   1. Templates never actually synced across devices/sessions.
--   2. Worse: any full replace-hydrate (hydrate(snap, false) — a real login,
--      or the stale-session race fixed alongside this migration) would wipe
--      local templates/clients to empty, because the cloud payload never
--      carried them to begin with.
--
-- `company` never existed on app_data AT ALL, despite cloudSync.js always
-- including it in every save payload — every personal-workspace (non-team)
-- save has been silently failing outright (Postgres rejects an upsert that
-- references a nonexistent column), which also meant projects/sheets/
-- everything else in that same upsert never persisted either. Team
-- workspaces were unaffected (org_data has always had `company`, added in
-- schema_teams.sql). This adds the missing columns; app_data.sql's
-- touch-updated_at trigger already fires on any column change, no changes
-- needed there.

alter table public.app_data
  add column if not exists company             jsonb,
  add column if not exists proposal_templates jsonb not null default '{}'::jsonb,
  add column if not exists mto_templates       jsonb not null default '{}'::jsonb,
  add column if not exists clients             jsonb not null default '{}'::jsonb;

alter table public.org_data
  add column if not exists proposal_templates jsonb not null default '{}'::jsonb,
  add column if not exists mto_templates       jsonb not null default '{}'::jsonb,
  add column if not exists clients             jsonb not null default '{}'::jsonb;
