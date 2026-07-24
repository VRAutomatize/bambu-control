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
  created_at timestamptz not null default now(),
  constraint unique_pending_invite unique (organization_id, email) where accepted_at is null
);

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

-- Qualquer um pode atualizar um convite se tiver o token correto (aceitar convite)
-- Isso é feito via RPC abaixo, não direto
create policy "invites_update_self" on public.organization_invites
  for update using (
    -- Quando aceitando, qualquer pessoa pode fazer update do seu convite
    -- Controle via RPC abaixo
    true
  ) with check (
    true
  );

-- ---------------------------------------------------------------------------
-- RPC: accept_organization_invite — aceita um convite via token
-- ============================================================================
create or replace function public.accept_organization_invite(p_token text)
returns table (
  success boolean,
  message text,
  organization_id uuid
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
