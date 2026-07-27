-- ============================================================================
-- ARQUIVO GERADO — não editar à mão.
-- Gerado por scripts/build-consolidated-sql.sh a partir de supabase/migrations/*.sql
-- Cole este arquivo inteiro no SQL Editor do Supabase (Dashboard → SQL Editor)
-- e rode uma única vez, na ordem que está aqui.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0001_foundation.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0002_providers_printers.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- 0002 — Conexões de provedor, impressoras e perfis de custo de máquina.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: aplica as policies padrão de org a uma tabela de negócio.
--   SELECT  → membros da org
--   INSERT/UPDATE/DELETE → papéis de escrita (owner/admin/operator)
-- A tabela precisa ter a coluna organization_id.
-- ---------------------------------------------------------------------------
create or replace function public.apply_standard_org_rls(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security;', p_table);

  execute format($f$
    create policy "%1$s_select_member" on public.%1$I
      for select using (organization_id in (select public.user_org_ids()));
  $f$, p_table);

  execute format($f$
    create policy "%1$s_insert_writer" on public.%1$I
      for insert with check (public.user_can_write(organization_id));
  $f$, p_table);

  execute format($f$
    create policy "%1$s_update_writer" on public.%1$I
      for update using (public.user_can_write(organization_id))
      with check (public.user_can_write(organization_id));
  $f$, p_table);

  execute format($f$
    create policy "%1$s_delete_writer" on public.%1$I
      for delete using (public.user_can_write(organization_id));
  $f$, p_table);
end;
$$;

-- ---------------------------------------------------------------------------
-- machine_cost_profiles
-- ---------------------------------------------------------------------------
create table public.machine_cost_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  calculation_mode text not null default 'calculated'
    check (calculation_mode in ('direct_hourly_rate', 'calculated')),
  direct_hourly_cost numeric(14, 4) not null default 0,
  purchase_price numeric(14, 4) not null default 0,
  residual_value numeric(14, 4) not null default 0,
  useful_life_hours numeric(14, 2) not null default 0,
  average_power_w numeric(14, 2) not null default 0,
  electricity_price_kwh numeric(14, 4) not null default 0,
  maintenance_cost_per_hour numeric(14, 4) not null default 0,
  overhead_cost_per_hour numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_mcp_org on public.machine_cost_profiles (organization_id);
create trigger trg_mcp_updated_at before update on public.machine_cost_profiles
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('machine_cost_profiles');

-- ---------------------------------------------------------------------------
-- provider_connections — credenciais de integração (token CRIPTOGRAFADO)
-- ---------------------------------------------------------------------------
create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null
    check (provider in ('bambu_cloud', 'bambu_lan', 'manual', 'simplyprint', 'generic')),
  display_name text not null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'connected', 'expired', 'error', 'disconnected')),
  -- Token/refresh criptografados (AES-256-GCM server-side). NUNCA texto puro.
  -- A senha original é descartada após a autenticação. Ver docs/security.md.
  encrypted_credentials text,
  token_expires_at timestamptz,
  last_sync_cursor text,
  last_synced_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pconn_org on public.provider_connections (organization_id);
create index idx_pconn_status on public.provider_connections (organization_id, status);
create trigger trg_pconn_updated_at before update on public.provider_connections
  for each row execute function public.set_updated_at();

-- RLS especial: SELECT NÃO expõe encrypted_credentials via app (a query do app
-- seleciona colunas explícitas). owner/admin gerenciam conexões; operator lê.
alter table public.provider_connections enable row level security;
create policy "pconn_select_member" on public.provider_connections
  for select using (organization_id in (select public.user_org_ids()));
create policy "pconn_insert_admin" on public.provider_connections
  for insert with check (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );
create policy "pconn_update_admin" on public.provider_connections
  for update using (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  ) with check (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );
create policy "pconn_delete_admin" on public.provider_connections
  for delete using (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );

-- ---------------------------------------------------------------------------
-- printers
-- ---------------------------------------------------------------------------
create table public.printers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider_connection_id uuid references public.provider_connections (id) on delete set null,
  external_device_id text,
  serial_number text,
  name text not null,
  model text,
  location text,
  active boolean not null default true,
  last_seen_at timestamptz,
  machine_cost_profile_id uuid references public.machine_cost_profiles (id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_connection_id, external_device_id)
);
create index idx_printers_org on public.printers (organization_id);
create index idx_printers_conn on public.printers (provider_connection_id);
create trigger trg_printers_updated_at before update on public.printers
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('printers');

-- ---------------------------------------------------------------------------
-- 0003_filaments_spools.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- 0003 — Filamentos (tipo/produto), rolos físicos (spools) e histórico de AMS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- filaments — tipo/produto de filamento
-- ---------------------------------------------------------------------------
create table public.filaments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  brand text,
  name text not null,
  material text,
  color_name text,
  color_hex text,
  diameter_mm numeric(6, 3) not null default 1.75,
  default_price_per_kg numeric(14, 4) not null default 0,
  density numeric(8, 4),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_filaments_org on public.filaments (organization_id);
create index idx_filaments_active on public.filaments (organization_id, active);
create trigger trg_filaments_updated_at before update on public.filaments
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('filaments');

-- ---------------------------------------------------------------------------
-- spools — rolo físico
-- ---------------------------------------------------------------------------
create table public.spools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  filament_id uuid not null references public.filaments (id) on delete restrict,
  label text,
  supplier text,
  purchase_price numeric(14, 4) not null default 0,
  initial_net_weight_g numeric(14, 2) not null default 1000,
  remaining_weight_g numeric(14, 2) not null default 1000,
  purchased_at date,
  lot_number text,
  status text not null default 'sealed'
    check (status in ('sealed', 'active', 'empty', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_spools_org on public.spools (organization_id);
create index idx_spools_filament on public.spools (filament_id);
create index idx_spools_status on public.spools (organization_id, status);
create trigger trg_spools_updated_at before update on public.spools
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('spools');

-- ---------------------------------------------------------------------------
-- ams_slot_assignments — histórico (não só estado atual) de rolo por slot AMS
-- ---------------------------------------------------------------------------
create table public.ams_slot_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  printer_id uuid not null references public.printers (id) on delete cascade,
  ams_unit integer not null default 0,
  slot_number integer not null,
  spool_id uuid references public.spools (id) on delete set null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  source text not null default 'manual'
    check (source in ('provider_ams', 'manual')),
  created_at timestamptz not null default now()
);
create index idx_ams_org on public.ams_slot_assignments (organization_id);
create index idx_ams_printer on public.ams_slot_assignments (printer_id, ams_unit, slot_number);
create index idx_ams_active on public.ams_slot_assignments (printer_id)
  where valid_until is null;
select public.apply_standard_org_rls('ams_slot_assignments');

-- ---------------------------------------------------------------------------
-- 0004_print_jobs.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- 0004 — Impressões, materiais por impressão e snapshots de custo.
-- Padrão provider_/manual_/effective_: dado do provedor nunca é sobrescrito
-- silenciosamente. effective_x = manual_x ?? provider_x (colunas geradas).
-- ============================================================================

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider_connection_id uuid references public.provider_connections (id) on delete set null,
  printer_id uuid references public.printers (id) on delete set null,

  external_task_id text,
  external_model_id text,
  title text,
  cover_url text,

  provider_status text,
  manual_status text
    check (manual_status is null or manual_status in
      ('pending','printing','completed','failed','cancelled','unknown')),
  normalized_status text not null default 'unknown'
    check (normalized_status in
      ('pending','printing','completed','failed','cancelled','unknown')),

  provider_start_at timestamptz,
  provider_end_at timestamptz,

  provider_duration_s numeric(14, 2),
  manual_duration_s numeric(14, 2),
  effective_duration_s numeric(14, 2)
    generated always as (coalesce(manual_duration_s, provider_duration_s)) stored,

  provider_weight_g numeric(14, 3),
  manual_weight_g numeric(14, 3),
  effective_weight_g numeric(14, 3)
    generated always as (coalesce(manual_weight_g, provider_weight_g)) stored,

  duration_source text,
  quantity_produced integer not null default 1 check (quantity_produced >= 0),
  failure_quantity integer not null default 0 check (failure_quantity >= 0),

  source text not null default 'manual'
    check (source in ('provider_ams','bambu_cloud','manual','csv_import','default_spool','estimated')),

  raw_payload_json jsonb,
  imported_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Sincronização idempotente: uma tarefa externa não pode duplicar.
  unique (provider_connection_id, external_task_id)
);
create index idx_pj_org on public.print_jobs (organization_id);
create index idx_pj_printer on public.print_jobs (organization_id, printer_id);
create index idx_pj_status on public.print_jobs (organization_id, normalized_status);
create index idx_pj_start on public.print_jobs (organization_id, provider_start_at desc);
create index idx_pj_conn_task on public.print_jobs (provider_connection_id, external_task_id);
create trigger trg_pj_updated_at before update on public.print_jobs
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('print_jobs');

-- ---------------------------------------------------------------------------
-- print_job_materials — múltiplos materiais por impressão
-- ---------------------------------------------------------------------------
create table public.print_job_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  print_job_id uuid not null references public.print_jobs (id) on delete cascade,
  filament_id uuid references public.filaments (id) on delete set null,
  spool_id uuid references public.spools (id) on delete set null,
  source text not null default 'manual'
    check (source in ('provider_ams','manual','default_spool','estimated')),
  weight_g numeric(14, 3) not null default 0,
  price_per_kg_snapshot numeric(14, 4) not null default 0,
  material_cost_snapshot numeric(14, 4) not null default 0,
  allocation_percentage numeric(6, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pjm_org on public.print_job_materials (organization_id);
create index idx_pjm_job on public.print_job_materials (print_job_id);
create trigger trg_pjm_updated_at before update on public.print_job_materials
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('print_job_materials');

-- ---------------------------------------------------------------------------
-- print_cost_snapshots — custos históricos IMUTÁVEIS e versionados.
-- Alterar preço atual de filamento/máquina NÃO altera snapshots antigos.
-- ---------------------------------------------------------------------------
create table public.print_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  print_job_id uuid not null references public.print_jobs (id) on delete cascade,
  calculation_version integer not null,
  material_cost numeric(14, 4) not null default 0,
  electricity_cost numeric(14, 4) not null default 0,
  depreciation_cost numeric(14, 4) not null default 0,
  maintenance_cost numeric(14, 4) not null default 0,
  machine_overhead_cost numeric(14, 4) not null default 0,
  labor_cost numeric(14, 4) not null default 0,
  failure_allowance_cost numeric(14, 4) not null default 0,
  packaging_cost numeric(14, 4) not null default 0,
  other_cost numeric(14, 4) not null default 0,
  total_cost numeric(14, 4) not null default 0,
  estimated boolean not null default false,
  calculated_at timestamptz not null default now(),
  calculation_input_json jsonb
);
create index idx_pcs_org on public.print_cost_snapshots (organization_id);
create index idx_pcs_job on public.print_cost_snapshots (print_job_id, calculated_at desc);

-- Snapshots são imutáveis: permitir SELECT e INSERT, bloquear UPDATE/DELETE.
alter table public.print_cost_snapshots enable row level security;
create policy "pcs_select_member" on public.print_cost_snapshots
  for select using (organization_id in (select public.user_org_ids()));
create policy "pcs_insert_writer" on public.print_cost_snapshots
  for insert with check (public.user_can_write(organization_id));
-- Sem policies de UPDATE/DELETE → imutável para clientes com RLS.

-- View: snapshot mais recente por impressão (usada por dashboard e detalhe).
create or replace view public.latest_print_cost_snapshots as
select distinct on (print_job_id) *
from public.print_cost_snapshots
order by print_job_id, calculated_at desc;

-- ---------------------------------------------------------------------------
-- 0005_crm_orders.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- 0005 — Clientes, pedidos, itens, associação N:N impressão↔item e pagamentos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- customers — dados sensíveis opcionais
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  document text,
  email text,
  phone text,
  whatsapp text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_org on public.customers (organization_id);
create index idx_customers_active on public.customers (organization_id, active);
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('customers');

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  order_number text not null,
  status text not null default 'draft'
    check (status in ('draft','quoted','approved','in_production','ready','delivered','cancelled')),
  ordered_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  subtotal numeric(14, 4) not null default 0,
  discount numeric(14, 4) not null default 0,
  shipping_amount numeric(14, 4) not null default 0,
  total_charged numeric(14, 4) not null default 0,
  total_paid numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_number)
);
create index idx_orders_org on public.orders (organization_id);
create index idx_orders_customer on public.orders (organization_id, customer_id);
create index idx_orders_status on public.orders (organization_id, status);
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('orders');

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  description text not null,
  quantity numeric(14, 3) not null default 1,
  unit_price numeric(14, 4) not null default 0,
  total_price numeric(14, 4) not null default 0,
  labor_cost numeric(14, 4) not null default 0,
  packaging_cost numeric(14, 4) not null default 0,
  other_cost numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_oi_org on public.order_items (organization_id);
create index idx_oi_order on public.order_items (order_id);
create trigger trg_oi_updated_at before update on public.order_items
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('order_items');

-- ---------------------------------------------------------------------------
-- order_item_print_jobs — N:N entre itens e impressões
-- Uma impressão pode produzir várias unidades / atender mais de um item.
-- ---------------------------------------------------------------------------
create table public.order_item_print_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  print_job_id uuid not null references public.print_jobs (id) on delete cascade,
  allocated_quantity numeric(14, 3) not null default 1,
  allocated_revenue numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  unique (order_item_id, print_job_id)
);
create index idx_oipj_org on public.order_item_print_jobs (organization_id);
create index idx_oipj_item on public.order_item_print_jobs (order_item_id);
create index idx_oipj_job on public.order_item_print_jobs (print_job_id);
select public.apply_standard_org_rls('order_item_print_jobs');

-- ---------------------------------------------------------------------------
-- payments — pagamentos parciais suportados
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(14, 4) not null,
  payment_method text,
  paid_at timestamptz,
  status text not null default 'confirmed'
    check (status in ('pending','confirmed','refunded','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_payments_org on public.payments (organization_id);
create index idx_payments_order on public.payments (order_id);
select public.apply_standard_org_rls('payments');

-- ---------------------------------------------------------------------------
-- 0006_sync_audit.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- 0006 — Execuções de sincronização e trilha de auditoria.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sync_runs — observabilidade de cada sincronização
-- ---------------------------------------------------------------------------
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider_connection_id uuid references public.provider_connections (id) on delete set null,
  status text not null default 'running'
    check (status in ('running','success','partial','error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  cursor_before text,
  cursor_after text,
  records_received integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_failed integer not null default 0,
  error_code text,
  error_message text,
  metadata_json jsonb not null default '{}'::jsonb
);
create index idx_sync_org on public.sync_runs (organization_id);
create index idx_sync_conn on public.sync_runs (provider_connection_id, started_at desc);
create index idx_sync_status on public.sync_runs (organization_id, status);

-- sync_runs são gravados pelo worker (service_role). Clientes só leem.
alter table public.sync_runs enable row level security;
create policy "sync_select_member" on public.sync_runs
  for select using (organization_id in (select public.user_org_ids()));

-- ---------------------------------------------------------------------------
-- audit_logs — auditoria de mudanças financeiras e de conexão
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_org on public.audit_logs (organization_id, created_at desc);
create index idx_audit_entity on public.audit_logs (organization_id, entity_type, entity_id);

-- audit_logs: apenas leitura por admin/owner; escrita via service_role.
alter table public.audit_logs enable row level security;
create policy "audit_select_admin" on public.audit_logs
  for select using (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );

-- ---------------------------------------------------------------------------
-- 0007_organization_invites.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- 0007 — Convites de membros: organização_invites com RLS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- organization_invites
-- ---------------------------------------------------------------------------
create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.org_role not null default 'viewer',
  token text not null unique default gen_random_uuid()::text,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Postgres não aceita "unique (...) where ..." como constraint inline —
-- unicidade parcial só existe como índice único.
create unique index unique_pending_invite
  on public.organization_invites (organization_id, email)
  where accepted_at is null;

create index idx_invites_org on public.organization_invites (organization_id);
create index idx_invites_email on public.organization_invites (email);
create index idx_invites_token on public.organization_invites (token);
create index idx_invites_expires on public.organization_invites (expires_at) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- RLS: organization_invites
-- ---------------------------------------------------------------------------
alter table public.organization_invites enable row level security;

-- Owner/admin podem criar e ver convites da sua org
create policy "invites_select_admin" on public.organization_invites
  for select using (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );

create policy "invites_insert_admin" on public.organization_invites
  for insert with check (
    public.user_has_org_role(organization_id, array['owner','admin']::public.org_role[])
  );

-- Apenas a RPC abaixo pode atualizar convites (via SECURITY DEFINER)
-- Bloqueamos UPDATE diretamente para forçar o fluxo de autenticação via RPC
create policy "invites_update_deny" on public.organization_invites
  for update using (false) with check (false);

-- ---------------------------------------------------------------------------
-- RPC: accept_organization_invite — aceita um convite via token
-- ============================================================================
-- NOTA: a coluna de retorno é "org_id" (não "organization_id") de propósito —
-- um OUT parameter chamado "organization_id" colide com a coluna de mesmo
-- nome em organization_members dentro do "on conflict (organization_id, ...)"
-- abaixo, e o Postgres recusa a função com "column reference ... is
-- ambiguous" (validado localmente antes de aplicar em produção).
create or replace function public.accept_organization_invite(p_token text)
returns table (
  success boolean,
  message text,
  org_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.organization_invites;
  v_user_id uuid;
begin
  if auth.uid() is null then
    return query select false, 'não autenticado'::text, null::uuid;
    return;
  end if;

  v_user_id := auth.uid();

  -- Busca o convite válido (não expirado, não aceito)
  select * into v_invite
  from public.organization_invites
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if v_invite is null then
    return query select false, 'convite inválido ou expirado'::text, null::uuid;
    return;
  end if;

  -- Cria/atualiza o membro da organização
  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_user_id, v_invite.role)
  on conflict (organization_id, user_id) do update
    set role = v_invite.role;

  -- Marca o convite como aceito
  update public.organization_invites
  set accepted_at = now()
  where id = v_invite.id;

  return query select true, 'convite aceito com sucesso'::text, v_invite.organization_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0008_spool_stock.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- 0008 — Estoque de filamento: abate automático do peso do rolo (spool)
-- quando uma impressão registra consumo de material vinculado a esse rolo.
-- Cobre tanto o cadastro manual quanto qualquer sync futuro que grave em
-- print_job_materials com spool_id preenchido.
-- ============================================================================

create or replace function public.apply_spool_consumption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.spool_id is not null then
    update public.spools
    set remaining_weight_g = greatest(remaining_weight_g - new.weight_g, 0),
        status = case
          when greatest(remaining_weight_g - new.weight_g, 0) <= 0 then 'empty'
          when status = 'sealed' then 'active'
          else status
        end
    where id = new.spool_id
      and organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

create trigger trg_print_job_materials_consume_spool
  after insert on public.print_job_materials
  for each row execute function public.apply_spool_consumption();

-- Reverte o consumo se o registro de material for removido (ex.: recálculo
-- que apaga e recria materiais de uma impressão).
create or replace function public.revert_spool_consumption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.spool_id is not null then
    update public.spools
    set remaining_weight_g = least(remaining_weight_g + old.weight_g, initial_net_weight_g),
        status = case when status = 'empty' then 'active' else status end
    where id = old.spool_id
      and organization_id = old.organization_id;
  end if;
  return old;
end;
$$;

create trigger trg_print_job_materials_revert_spool
  after delete on public.print_job_materials
  for each row execute function public.revert_spool_consumption();

