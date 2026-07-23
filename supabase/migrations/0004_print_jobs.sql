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
