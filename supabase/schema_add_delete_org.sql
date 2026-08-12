-- ============================================================================
-- Plotline — team deletion (delete_organization RPC + an owner-lock policy)
-- ============================================================================
-- Run this in the Supabase SQL editor AFTER schema.sql, schema_teams.sql, and
-- the other schema_add_*.sql migrations.
--
-- Today, a team's creator can "leave" it exactly like any other member,
-- abandoning the organizations/org_data rows with no members left attached —
-- a ghost row that permanently occupies storage with nobody left who can
-- even see it to clean up (org_data/org_members RLS is membership-gated).
-- One of these ghost rows was found holding ~49MB of legacy embedded PDF
-- data, large enough to make every save to a DIFFERENT, active team time out.
--
-- This adds a real deletion path — only the org's owner (organizations.
-- owner_id) can call delete_organization(), which removes the organizations
-- row outright. org_members, org_invites, and org_data all cascade-delete
-- via their existing "on delete cascade" foreign keys (schema_teams.sql), so
-- one call reliably cleans up every trace of the team. The owner_lock policy
-- below additionally prevents the owner's own org_members row from being
-- deleted by anyone (including themselves) via the normal "leave" path, so
-- the only way to stop being on the team you created is to delete it.

create or replace function public.delete_organization(target_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  select (owner_id = auth.uid()) into is_owner
  from public.organizations
  where id = target_org;

  if is_owner is null then
    raise exception 'Team not found';
  end if;

  if not is_owner then
    raise exception 'Only the team''s creator can delete it';
  end if;

  -- org_members, org_invites, and org_data all reference organizations(id)
  -- on delete cascade — deleting this one row removes every trace of the
  -- team, not just the caller's own membership.
  delete from public.organizations where id = target_org;
end;
$$;

revoke all on function public.delete_organization(uuid) from public;
grant execute on function public.delete_organization(uuid) to authenticated;

-- Owner lock: nobody (not an admin, not the owner themselves) can remove the
-- owner's own org_members row via the normal leave/remove path — the only
-- way off a team you created is to delete it via delete_organization() above.
drop policy if exists org_members_delete on public.org_members;
create policy org_members_delete
  on public.org_members for delete
  using (
    (public.is_org_admin(org_id) or user_id = auth.uid())
    and not exists (
      select 1 from public.organizations o
      where o.id = org_members.org_id and o.owner_id = org_members.user_id
    )
  );
