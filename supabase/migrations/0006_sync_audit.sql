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
