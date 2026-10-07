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
-- links: short links (无需登录，user_id 允许为空)
-- -----------------------------------------------------------------------------
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  code text not null unique,
  target_url text,
  whatsapp_number text,
  description text,
  created_at timestamptz not null default now()
);

-- 兼容已存在的旧表：补齐新字段 / 放宽约束
-- （如果表是新建的，以下语句为无操作）
alter table public.links alter column user_id drop not null;
alter table public.links alter column target_url drop not null;
alter table public.links add column if not exists whatsapp_number text;
alter table public.links add column if not exists description text;

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

-- -----------------------------------------------------------------------------
-- routing_rules: per-country WhatsApp number overrides for a link
-- -----------------------------------------------------------------------------
create table if not exists public.routing_rules (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.links (id) on delete cascade,
  country text not null, -- 国家代码，例如 'CN', 'US'
  whatsapp_number text not null, -- 该国家跳转的 WhatsApp 号码
  created_at timestamptz not null default now()
);

-- 兼容已存在的旧表：放宽 link_id 约束
alter table public.routing_rules alter column link_id drop not null;

create index if not exists routing_rules_link_id_idx on public.routing_rules (link_id);

-- -----------------------------------------------------------------------------
-- total_links: 总链接（入口），本身不绑定号码，仅作为聚合入口
-- -----------------------------------------------------------------------------
create table if not exists public.total_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text, -- 总链接名称（给自己看的，支持中文）
  description text,
  domain text, -- 短链域名，例如 5r8.cn / y41.cn
  switch_mode text not null default 'random', -- 子链接切换方式：random / sequential / round_robin
  created_at timestamptz not null default now()
);

-- 兼容已存在的旧表：补齐新字段
alter table public.total_links add column if not exists display_name text;
alter table public.total_links add column if not exists domain text;
alter table public.total_links add column if not exists switch_mode text not null default 'random';

-- 上限逻辑已迁移到 total_link_items（每个子链接各自配置每日/累计上限），
-- 总链接层面不再需要 limit_type / sub_links 字段。
alter table public.total_links drop column if exists limit_type;
alter table public.total_links drop column if exists sub_links;

create index if not exists total_links_code_idx on public.total_links (code);

-- -----------------------------------------------------------------------------
-- total_link_items: 总链接下的子链接（短链接）及其权重与上限
-- -----------------------------------------------------------------------------
create table if not exists public.total_link_items (
  id uuid primary key default gen_random_uuid(),
  total_link_id uuid not null references public.total_links (id) on delete cascade,
  short_link_id uuid not null references public.links (id) on delete cascade,
  weight integer not null default 1,
  daily_limit integer not null default 30, -- 每日上限（0 = 不限）
  total_limit integer not null default 0, -- 累计上限（0 = 不限）
  created_at timestamptz not null default now()
);

-- 兼容已存在的旧表：补齐上限字段
alter table public.total_link_items add column if not exists daily_limit integer not null default 30;
alter table public.total_link_items add column if not exists total_limit integer not null default 0;

create index if not exists total_link_items_total_link_id_idx
  on public.total_link_items (total_link_id);
create index if not exists total_link_items_short_link_id_idx
  on public.total_link_items (short_link_id);

-- -----------------------------------------------------------------------------
-- click_logs: 分流点击日志（记录每次跳转命中的短链接与国家）
-- -----------------------------------------------------------------------------
create table if not exists public.click_logs (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.links (id) on delete cascade,
  short_link_id uuid references public.links (id) on delete cascade,
  country text,
  whatsapp_number text, -- 本次跳转命中的号码（用于统计子链接上限）
  created_at timestamptz default now()
);

-- 兼容已存在的旧表：补齐号码字段
alter table public.click_logs add column if not exists whatsapp_number text;

create index if not exists click_logs_link_id_idx on public.click_logs (link_id);
create index if not exists click_logs_short_link_id_idx on public.click_logs (short_link_id);
create index if not exists click_logs_created_at_idx on public.click_logs (created_at);
create index if not exists click_logs_whatsapp_number_idx on public.click_logs (whatsapp_number);

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.links enable row level security;
alter table public.routing_rules enable row level security;
alter table public.total_links enable row level security;
alter table public.total_link_items enable row level security;

-- click_logs: 关闭 RLS，允许匿名写入点击日志
alter table public.click_logs disable row level security;

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
-- links policies: 无需登录，对所有匿名用户开放读写权限
-- -----------------------------------------------------------------------------
drop policy if exists "links_select_own" on public.links;
drop policy if exists "links_insert_own" on public.links;
drop policy if exists "links_update_own" on public.links;
drop policy if exists "links_delete_own" on public.links;

drop policy if exists "allow_all_anon_links" on public.links;
create policy "allow_all_anon_links"
  on public.links
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- routing_rules policies: 无需登录，对所有匿名用户开放读写权限
-- -----------------------------------------------------------------------------
drop policy if exists "allow_all_anon_routing_rules" on public.routing_rules;
create policy "allow_all_anon_routing_rules"
  on public.routing_rules
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- total_links policies: 无需登录，对所有匿名用户开放读写权限
-- -----------------------------------------------------------------------------
drop policy if exists "allow_all_anon_total_links" on public.total_links;
create policy "allow_all_anon_total_links"
  on public.total_links
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- total_link_items policies: 无需登录，对所有匿名用户开放读写权限
-- -----------------------------------------------------------------------------
drop policy if exists "allow_all_anon_total_link_items" on public.total_link_items;
create policy "allow_all_anon_total_link_items"
  on public.total_link_items
  for all
  to anon, authenticated
  using (true)
  with check (true);

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
