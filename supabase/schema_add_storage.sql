-- ============================================================================
-- Plotline — PDF Storage bucket + RLS, and the phrases/vendors columns
-- ============================================================================
-- Run this in the Supabase SQL editor AFTER schema.sql, schema_teams.sql, and
-- the other schema_add_*.sql migrations.
--
-- Part 1: uploaded PDFs have always been base64-encoded and embedded directly
-- as text inside app_data.sheets / org_data.sheets (and the shared pdf_assets
-- map) — the wrong medium for binary data. One team's org_data row grew to
-- ~49MB of embedded PDF text, large enough that Postgres started rejecting
-- every save to that row with a statement timeout, which blocked ALL of that
-- team's saves (not just the oversized one). This adds a private Storage
-- bucket (`sheet-pdfs`) with RLS mirroring app_data/org_data's own ownership
-- model, so PDFs can live as real objects instead of JSONB text. The client
-- (src/data/pdfStorage.js) uploads new PDFs here going forward, and
-- self-heals existing accounts' legacy embedded PDFs into it on next sign-in.
--
-- Part 2: `phrases` and `vendors` are real, persisted app data (proposal
-- boilerplate snippets and the vendor directory) that have never had a cloud
-- column at all — genuinely local-only for every user, cloud sync or not,
-- since the very first schema. Adding them now closes that gap the same way
-- schema_add_templates.sql closed it for company/proposalTemplates/etc.

-- ---------------------------------------------------------------------------
-- Part 1: sheet-pdfs Storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('sheet-pdfs', 'sheet-pdfs', false)
on conflict (id) do nothing;

-- Path convention: personal/{user_id}/{file_id}.pdf or org/{org_id}/{file_id}.pdf
-- (storage.foldername(name) splits the object path into folder segments).
-- Reuses public.is_org_member() from schema_teams.sql so org-scoped access
-- matches org_data's own RLS exactly.
drop policy if exists sheet_pdfs_rw on storage.objects;
create policy sheet_pdfs_rw
  on storage.objects for all
  using (
    bucket_id = 'sheet-pdfs' and (
      ((storage.foldername(name))[1] = 'personal' and (storage.foldername(name))[2] = auth.uid()::text)
      or ((storage.foldername(name))[1] = 'org' and public.is_org_member(((storage.foldername(name))[2])::uuid))
    )
  )
  with check (
    bucket_id = 'sheet-pdfs' and (
      ((storage.foldername(name))[1] = 'personal' and (storage.foldername(name))[2] = auth.uid()::text)
      or ((storage.foldername(name))[1] = 'org' and public.is_org_member(((storage.foldername(name))[2])::uuid))
    )
  );

-- ---------------------------------------------------------------------------
-- Part 2: phrases / vendors columns
-- ---------------------------------------------------------------------------

alter table public.app_data
  add column if not exists phrases jsonb not null default '{}'::jsonb,
  add column if not exists vendors jsonb not null default '[]'::jsonb;

alter table public.org_data
  add column if not exists phrases jsonb not null default '{}'::jsonb,
  add column if not exists vendors jsonb not null default '[]'::jsonb;
