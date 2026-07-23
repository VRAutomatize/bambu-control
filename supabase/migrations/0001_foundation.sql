-- ============================================================================
-- 0001 — Fundação: extensões, organizações, perfis, membros, helpers, RLS base.
-- Multi-tenant: toda tabela de negócio referencia organization_id e é protegida
-- por Row Level Security baseada em organization_members.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Trigger genérico de updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Papéis
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'operator', 'viewer');

-- ---------------------------------------------------------------------------
-- profiles — espelho de auth.users (dados de aplicação do usuário)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria profile automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index idx_org_members_user on public.organization_members (user_id);
create index idx_org_members_org on public.organization_members (organization_id);

-- ---------------------------------------------------------------------------
-- Helpers de autorização (SECURITY DEFINER evita recursão de RLS)
-- ---------------------------------------------------------------------------

-- Orgs em que o usuário logado é membro
create or replace function public.user_org_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid();
$$;

-- Verifica se o usuário logado tem um dos papéis na org
create or replace function public.user_has_org_role(org uuid, roles public.org_role[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org
      and user_id = auth.uid()
      and role = any (roles)
  );
$$;

-- Papéis que podem escrever dados operacionais (não-viewer)
create or replace function public.user_can_write(org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.user_has_org_role(org, array['owner','admin','operator']::public.org_role[]);
$$;

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: organizations
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;

create policy "orgs_select_member" on public.organizations
  for select using (id in (select public.user_org_ids()));

-- Qualquer usuário autenticado pode criar uma organização (vira owner via app/trigger)
create policy "orgs_insert_authenticated" on public.organizations
  for insert with check (auth.uid() is not null);

create policy "orgs_update_admin" on public.organizations
  for update using (public.user_has_org_role(id, array['owner','admin']::public.org_role[]))
  with check (public.user_has_org_role(id, array['owner','admin']::public.org_role[]));

create policy "orgs_delete_owner" on public.organizations
  for delete using (public.user_has_org_role(id, array['owner']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- RLS: organization_members
-- ---------------------------------------------------------------------------
alter table public.organization_members enable row level security;

create policy "members_select_same_org" on public.organization_members
  for select using (organization_id in (select public.user_org_ids()));

-- Apenas owner/admin gerenciam membros (operator/viewer não)
create policy "members_insert_admin" on public.organization_members
  for insert with check (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );
create policy "members_update_admin" on public.organization_members
  for update using (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  ) with check (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );
create policy "members_delete_admin" on public.organization_members
  for delete using (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );

-- ---------------------------------------------------------------------------
-- RPC: create_organization — cria org + membership owner atomicamente.
-- SECURITY DEFINER para contornar o problema de bootstrap (o primeiro membro
-- não pode ser inserido pela policy que exige já ser admin).
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_currency text default 'BRL',
  p_timezone text default 'America/Sao_Paulo'
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;

  insert into public.organizations (name, slug, currency, timezone)
  values (p_name, p_slug, p_currency, p_timezone)
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, auth.uid(), 'owner');

  return v_org;
end;
$$;
