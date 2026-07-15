-- ============================================================================
-- Plotline — add pdf_assets column to the cloud snapshot tables
-- ============================================================================
-- Run this in the Supabase SQL editor AFTER schema.sql, schema_teams.sql, and
-- schema_add_templates.sql.
--
-- The sheet upload wizard splits one multi-page PDF into N sheets. It used to
-- embed a full base64 copy of the *entire source PDF* into every one of those
-- N sheets' `pdfUrl` — a 20-sheet plan set meant 20x the bytes, re-sent to
-- the cloud on every autosave. That's the real cause of slow/failed saves on
-- multi-page uploads.
--
-- Sheets now carry a lightweight `pdfAssetId` referencing a SHARED entry in
-- `pdfAssets` (keyed by source-file id), so a multi-page PDF is stored once
-- regardless of how many sheets it was split into. This adds the column that
-- shared map is persisted to; app_data.sql's touch-updated_at trigger already
-- fires on any column change, no changes needed there.

alter table public.app_data
  add column if not exists pdf_assets jsonb not null default '{}'::jsonb;

alter table public.org_data
  add column if not exists pdf_assets jsonb not null default '{}'::jsonb;
