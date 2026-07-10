-- ============================================================================
-- Plotline — Supabase cloud persistence schema
-- ============================================================================
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- One row per auth user; collections stored as JSONB so the client can read/write
-- the whole snapshot in a single upsert. Row Level Security keeps every user's
-- data isolated to their own auth.uid().

create table if not exists public.app_data (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  projects     jsonb not null default '{}'::jsonb,
  sheets       jsonb not null default '{}'::jsonb,
  custom_cats  jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

-- Keep updated_at fresh on every write.
create or replace function public.touch_app_data_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_data_touch on public.app_data;
create trigger trg_app_data_touch
  before update on public.app_data
  for each row execute function public.touch_app_data_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — users may only read/write their own row.
-- ---------------------------------------------------------------------------
alter table public.app_data enable row level security;

drop policy if exists app_data_select on public.app_data;
create policy app_data_select
  on public.app_data for select
  using (auth.uid() = user_id);

drop policy if exists app_data_insert on public.app_data;
create policy app_data_insert
  on public.app_data for insert
  with check (auth.uid() = user_id);

drop policy if exists app_data_update on public.app_data;
create policy app_data_update
  on public.app_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (Optional) let authenticated users create their own row even before it exists.
drop policy if exists app_data_delete on public.app_data;
create policy app_data_delete
  on public.app_data for delete
  using (auth.uid() = user_id);
