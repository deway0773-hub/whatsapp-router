-- =============================================================================
-- WhatsApp Smart Router — Database Schema
-- Target: Supabase (PostgreSQL)
-- Run this file in the Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- =============================================================================
-- Tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: one row per auth user
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- links: short links owned by a user
-- -----------------------------------------------------------------------------
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  target_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists links_user_id_idx on public.links (user_id);
create index if not exists links_code_idx on public.links (code);

-- -----------------------------------------------------------------------------
-- clicks: click log for each link
-- -----------------------------------------------------------------------------
create table if not exists public.clicks (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.links (id) on delete cascade,
  country text,
  utm_source text,
  created_at timestamptz not null default now()
);

create index if not exists clicks_link_id_idx on public.clicks (link_id);
create index if not exists clicks_created_at_idx on public.clicks (created_at);

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.links enable row level security;

-- -----------------------------------------------------------------------------
-- profiles policies: users can only read and update their own profile
-- -----------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- links policies: users can only manage their own links
-- -----------------------------------------------------------------------------
drop policy if exists "links_select_own" on public.links;
create policy "links_select_own"
  on public.links
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "links_insert_own" on public.links;
create policy "links_insert_own"
  on public.links
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "links_update_own" on public.links;
create policy "links_update_own"
  on public.links
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "links_delete_own" on public.links;
create policy "links_delete_own"
  on public.links
  for delete
  to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- Trigger: create a profile row when a new auth user signs up
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
