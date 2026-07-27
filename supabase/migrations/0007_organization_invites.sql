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
