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
