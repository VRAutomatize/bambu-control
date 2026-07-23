-- Harness de teste de RLS (local). Simula usuários e organizações distintas.
\set ON_ERROR_STOP on

grant usage on schema public to authenticated;
grant usage on schema auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function auth.uid() to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@ex.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@ex.com'),
  ('33333333-3333-3333-3333-333333333333', 'viewer@ex.com'),
  ('44444444-4444-4444-4444-444444444444', 'operator@ex.com');

-- ============ Usuário A cria org A ============
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select id as orga_id from public.create_organization('Org A', 'org-a') \gset
insert into public.customers (organization_id, name) values (:'orga_id', 'Cliente A1');
reset role;

-- Guarda o id da org A em uma configuração de sessão para uso nos DO blocks.
select set_config('app.orga', :'orga_id', false);

-- Adiciona viewer e operator na org A.
insert into public.organization_members (organization_id, user_id, role) values
  (:'orga_id', '33333333-3333-3333-3333-333333333333', 'viewer'),
  (:'orga_id', '44444444-4444-4444-4444-444444444444', 'operator');

-- ============ Usuário B cria org B ============
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select id as orgb_id from public.create_organization('Org B', 'org-b') \gset
insert into public.customers (organization_id, name) values (:'orgb_id', 'Cliente B1');

-- TESTE 1: B só enxerga a própria org.
do $$
declare n int;
begin
  select count(*) into n from public.organizations;
  assert n = 1, 'FALHA T1: B deveria ver 1 org, viu ' || n;
end $$;

-- TESTE 2: B não enxerga clientes da org A (isolamento).
do $$
declare n int;
begin
  select count(*) into n from public.customers;
  assert n = 1, 'FALHA T2: B deveria ver 1 cliente, viu ' || n;
end $$;

-- TESTE 3: B não consegue inserir cliente na org A (IDOR bloqueado).
do $$
begin
  insert into public.customers (organization_id, name)
  values (current_setting('app.orga')::uuid, 'invasor');
  raise exception 'FALHA T3: insert cross-org NÃO deveria passar';
exception
  when insufficient_privilege then null; -- RLS negou, esperado
end $$;
reset role;

-- TESTE 4: viewer NÃO pode inserir cliente.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  insert into public.customers (organization_id, name)
  values (current_setting('app.orga')::uuid, 'x');
  raise exception 'FALHA T4: viewer NÃO deveria inserir';
exception
  when insufficient_privilege then null;
end $$;
reset role;

-- TESTE 5: operator NÃO pode gerenciar membros.
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (current_setting('app.orga')::uuid, '22222222-2222-2222-2222-222222222222', 'viewer');
  raise exception 'FALHA T5: operator NÃO deveria gerenciar membros';
exception
  when insufficient_privilege then null;
end $$;

-- TESTE 6: operator PODE inserir cliente (papel de escrita).
insert into public.customers (organization_id, name)
values (current_setting('app.orga')::uuid, 'Cliente do operator');

-- TESTE 7: snapshots de custo são imutáveis (sem policy de UPDATE).
insert into public.print_jobs (organization_id, title, source)
  values (current_setting('app.orga')::uuid, 'Job teste', 'manual')
  returning id as job_id \gset
insert into public.print_cost_snapshots
  (organization_id, print_job_id, calculation_version, total_cost)
  values (current_setting('app.orga')::uuid, :'job_id', 1, 10.00);
-- Sem policy de UPDATE, a RLS torna a linha invisível ao UPDATE: 0 linhas
-- afetadas, valor permanece intacto (imutabilidade efetiva).
do $$
declare v numeric;
begin
  update public.print_cost_snapshots set total_cost = 999 where calculation_version = 1;
  select total_cost into v from public.print_cost_snapshots where calculation_version = 1;
  assert v = 10.00, 'FALHA T7: snapshot foi alterado para ' || v;
  -- DELETE também deve ser no-op (sem policy de DELETE).
  delete from public.print_cost_snapshots where calculation_version = 1;
  perform 1 from public.print_cost_snapshots where calculation_version = 1;
  assert found, 'FALHA T7b: snapshot foi deletado';
end $$;
reset role;

select 'TODOS OS TESTES DE RLS PASSARAM' as resultado;
