-- ============================================================================
-- Plotline — cache each member's display name on org_members
-- ============================================================================
-- Run this in the Supabase SQL editor AFTER schema.sql, schema_teams.sql,
-- schema_add_templates.sql, schema_add_pdf_assets.sql, and
-- schema_add_ocr_memory.sql.
--
-- org_members has always cached `email` at join time (roster pages can't
-- otherwise read auth.users without service-role access) but never a name,
-- so the Team page's roster and "Assigned to" pickers had nothing to show
-- but raw email addresses. Account Settings already lets a user set a
-- display name (stored in their Supabase auth user_metadata) — this adds
-- the same join-time caching for it.
--
-- Same known limitation as email: cached at the moment someone JOINS (or
-- re-accepts an invite), not kept live afterward. If a member changes their
-- name later, existing org rosters won't see it until they leave/rejoin —
-- consistent with how email already behaves here, not a new tradeoff.

alter table public.org_members
  add column if not exists full_name text;

-- One-time backfill: pick up names for people who are ALREADY members (like
-- an existing admin) so this doesn't only apply to joins from here forward.
-- auth.users.raw_user_meta_data is readable from the SQL editor's elevated
-- role even though the app's own (anon/authenticated) client can't see it.
update public.org_members om
set full_name = au.raw_user_meta_data ->> 'full_name'
from auth.users au
where om.user_id = au.id
  and om.full_name is null
  and au.raw_user_meta_data ->> 'full_name' is not null;

create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if org_name is null or length(trim(org_name)) = 0 then
    raise exception 'Organization name is required';
  end if;

  insert into public.organizations (name, owner_id)
  values (trim(org_name), auth.uid())
  returning id into new_org_id;

  insert into public.org_members (org_id, user_id, role, email, full_name)
  values (
    new_org_id, auth.uid(), 'admin',
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'full_name'
  );

  insert into public.org_data (org_id) values (new_org_id);

  return new_org_id;
end;
$$;

create or replace function public.accept_org_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.org_invites%rowtype;
  my_email text;
begin
  my_email := auth.jwt() ->> 'email';
  if my_email is null then
    raise exception 'You must be signed in to accept an invite';
  end if;

  select * into inv from public.org_invites
  where token = invite_token and status = 'pending' and expires_at > now();

  if not found then
    raise exception 'This invite is invalid, expired, or already used';
  end if;

  if lower(inv.email) <> lower(my_email) then
    raise exception 'This invite was sent to a different email address';
  end if;

  insert into public.org_members (org_id, user_id, role, email, full_name)
  values (
    inv.org_id, auth.uid(), inv.role, my_email,
    auth.jwt() -> 'user_metadata' ->> 'full_name'
  )
  on conflict (org_id, user_id) do update
    set role = excluded.role, full_name = excluded.full_name;

  update public.org_invites set status = 'accepted' where id = inv.id;

  return inv.org_id;
end;
$$;
