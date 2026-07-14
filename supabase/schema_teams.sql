-- ============================================================================
-- Plotline — Teams / organizations schema
-- ============================================================================
-- Run this AFTER schema.sql (Dashboard → SQL → New query → paste → Run).
--
-- Adds organization-scoped project storage so a company account can share one
-- pool of projects/sheets across invited teammates, instead of every user
-- owning a private, isolated `app_data` row.
--
-- Model:
--   - A user can belong to any number of organizations; the client tracks
--     which ONE is the active "workspace" at a time and can switch between
--     them (including back to their personal workspace).
--   - `organizations` / `org_members` / `org_invites` handle membership.
--   - `org_data` is a shared row per org (parallel to `app_data`, but readable
--     /writable by every member) holding the org's projects/sheets/etc.
--   - Invites are link-based: an admin creates an invite row, copies the
--     generated link, and sends it manually (no outbound email — this app has
--     no server component to send mail from). Whoever opens the link and
--     signs in with the matching email can accept and join.
--   - CRM-style "assign project to teammate" does NOT need a new table: a
--     project is just an entry in `org_data.projects` (jsonb), so the client
--     can set `assignedTo: <user_id>` on it directly via the existing
--     `updateProject()` mutator, same as any other project field.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member' check (role in ('admin', 'member')),
  -- Cached at join time so the roster can render an email without needing
  -- service-role access to auth.users.
  email       text,
  joined_at   timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.org_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  invited_by  uuid references auth.users (id),
  token       uuid not null default gen_random_uuid() unique,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days')
);

create table if not exists public.org_data (
  org_id      uuid primary key references public.organizations (id) on delete cascade,
  projects    jsonb not null default '{}'::jsonb,
  sheets      jsonb not null default '{}'::jsonb,
  custom_cats jsonb not null default '[]'::jsonb,
  company     jsonb,
  updated_at  timestamptz not null default now()
);

-- Keep updated_at fresh on every write.
create or replace function public.touch_org_data_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_org_data_touch on public.org_data;
create trigger trg_org_data_touch
  before update on public.org_data
  for each row execute function public.touch_org_data_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer so RLS policies below don't recurse
-- into org_members while evaluating a policy ON org_members).
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = target_org and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = target_org and user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.org_members   enable row level security;
alter table public.org_invites   enable row level security;
alter table public.org_data      enable row level security;

-- organizations: members can read; admins can rename. Creation happens only
-- through create_organization() below (no direct insert policy), so a new
-- org always arrives with exactly one admin member in the same transaction.
drop policy if exists organizations_select on public.organizations;
create policy organizations_select
  on public.organizations for select
  using (public.is_org_member(id));

drop policy if exists organizations_update on public.organizations;
create policy organizations_update
  on public.organizations for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- org_members: members can see their org's roster. Admins can change roles /
-- remove members; anyone can remove themselves (leave). No direct insert
-- policy — joining happens via create_organization() or accept_org_invite().
drop policy if exists org_members_select on public.org_members;
create policy org_members_select
  on public.org_members for select
  using (public.is_org_member(org_id));

drop policy if exists org_members_update on public.org_members;
create policy org_members_update
  on public.org_members for update
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

drop policy if exists org_members_delete on public.org_members;
create policy org_members_delete
  on public.org_members for delete
  using (public.is_org_admin(org_id) or user_id = auth.uid());

-- org_invites: admins manage invites for their org; an invitee can see invites
-- addressed to their own email (so the accept page can preview it before
-- calling the RPC). Only admins can create/revoke.
drop policy if exists org_invites_select on public.org_invites;
create policy org_invites_select
  on public.org_invites for select
  using (
    public.is_org_admin(org_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists org_invites_insert on public.org_invites;
create policy org_invites_insert
  on public.org_invites for insert
  with check (public.is_org_admin(org_id));

drop policy if exists org_invites_update on public.org_invites;
create policy org_invites_update
  on public.org_invites for update
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- org_data: shared workspace — any member can read/write the whole snapshot,
-- same "single upsert" shape as the personal app_data table.
drop policy if exists org_data_select on public.org_data;
create policy org_data_select
  on public.org_data for select
  using (public.is_org_member(org_id));

drop policy if exists org_data_insert on public.org_data;
create policy org_data_insert
  on public.org_data for insert
  with check (public.is_org_member(org_id));

drop policy if exists org_data_update on public.org_data;
create policy org_data_update
  on public.org_data for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- RPCs — the only way to create an org, or accept an invite. Both need to do
-- more than one write atomically (and, for invites, verify the inviting
-- email server-side), so they're security definer functions rather than
-- something the client assembles from raw inserts.
-- ---------------------------------------------------------------------------

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

  insert into public.org_members (org_id, user_id, role, email)
  values (new_org_id, auth.uid(), 'admin', auth.jwt() ->> 'email');

  insert into public.org_data (org_id) values (new_org_id);

  return new_org_id;
end;
$$;

revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

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

  insert into public.org_members (org_id, user_id, role, email)
  values (inv.org_id, auth.uid(), inv.role, my_email)
  on conflict (org_id, user_id) do update set role = excluded.role;

  update public.org_invites set status = 'accepted' where id = inv.id;

  return inv.org_id;
end;
$$;

revoke all on function public.accept_org_invite(uuid) from public;
grant execute on function public.accept_org_invite(uuid) to authenticated;

-- Lets the /invite/:token page show "You're invited to join <org>" before the
-- viewer is necessarily a member (or even matches the invite email yet).
-- Deliberately narrow: only the org name + role + status + target email.
create or replace function public.get_invite_preview(invite_token uuid)
returns table (org_name text, role text, status text, email text)
language sql
security definer
stable
set search_path = public
as $$
  select o.name, i.role, i.status, i.email
  from public.org_invites i
  join public.organizations o on o.id = i.org_id
  where i.token = invite_token;
$$;

revoke all on function public.get_invite_preview(uuid) from public;
grant execute on function public.get_invite_preview(uuid) to authenticated;
