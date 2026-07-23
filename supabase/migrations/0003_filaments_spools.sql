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
