-- ============================================================================
-- Plotline — add ocr_memory column to the cloud snapshot tables
-- ============================================================================
-- Run this in the Supabase SQL editor AFTER schema.sql, schema_teams.sql,
-- schema_add_templates.sql, and schema_add_pdf_assets.sql.
--
-- Backs the sheet-upload wizard's "correction memory": when a user confirms
-- or corrects an auto-filled sheet number / title, the value (and its
-- format) gets remembered here so future uploads on the same account can
-- validate guesses against a learned pattern and predict the next value in
-- a sequence when OCR fails. See src/data/ocrLearning.js — this is pattern
-- learning, not a trained ML model.

alter table public.app_data
  add column if not exists ocr_memory jsonb not null default '{"sheetNum":{"samples":[],"corrections":[]},"title":{"samples":[],"corrections":[]}}'::jsonb;

alter table public.org_data
  add column if not exists ocr_memory jsonb not null default '{"sheetNum":{"samples":[],"corrections":[]},"title":{"samples":[],"corrections":[]}}'::jsonb;
