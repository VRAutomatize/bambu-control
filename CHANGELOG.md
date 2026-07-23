# Changelog

## [0.1.0] — Fundação e fatia vertical

### Adicionado

- **Monorepo** Turborepo/pnpm, TypeScript estrito, Prettier, `.env.example`.
- **Motor de custos** puro e versionado (`@bambu/domain`): dinheiro em BigInt
  (sem float), material/energia/depreciação/manutenção/overhead/hora-direta/
  reserva-de-falha, lucro e margem (null em receita zero). 20 testes.
- **Normalização Bambu** defensiva (`normalizeBambuTask`) + fixtures. 18 testes.
- **Banco Supabase**: 19 tabelas com `organization_id`, RLS por org e papel,
  helpers SECURITY DEFINER, `create_organization` RPC, padrão
  `provider_/manual_/effective_`, snapshots imutáveis, `unique` para sync
  idempotente, índices. Seed de demonstração. Testes de RLS validados em Postgres.
- **Providers** (`@bambu/providers`): abstração `PrinterProvider`, `manual`,
  `bambu_mock` (fixtures+paginação), `bambu_cloud` (HTTP real, somente leitura,
  atrás de `BAMBU_LIVE_ENABLED`), cripto AES-256-GCM de credenciais, motor de
  sync idempotente (paginação/dedup/backoff/timeout/maxPages). 12 testes.
- **Contracts** (`@bambu/contracts`): schemas Zod para orgs, filamentos, perfis
  de custo, impressões manuais, clientes, pedidos, pagamentos, conexão Bambu.
- **App web** (`apps/web`): auth Supabase (login/cadastro/recuperação), onboarding,
  shell com sidebar, e telas ligadas a dados reais — dashboard (KPIs via motor de
  custos), impressões (lista/filtros + criação manual com custo + detalhe),
  filamentos, impressoras (+perfil de custo), clientes, pedidos (criação +
  associação de impressão + pagamentos parciais + lucro/margem), integrações
  (conectar mock + sincronizar agora), relatórios, configurações.
- **Worker** (`apps/worker`): sincronização automática com lock por conexão.
- **Deploy**: Dockerfiles (web standalone + worker) e `railway.json` para Railway.
- **CI**: typecheck, testes, build e validação de migrations+RLS em Postgres.
- **Docs**: plano, ADR de providers, motor de custos, segurança, deploy.

### Verificado

- `pnpm typecheck` limpo; `pnpm test` (50 testes) verde; `next build` (19 rotas).
- Migrations + RLS + seed aplicados em Postgres 16; testes de isolamento passam.

### Limitações conhecidas

- `bambu_cloud` real usa endpoints hipotéticos (engenharia reversa) — validar com
  credenciais reais antes de ligar `BAMBU_LIVE_ENABLED`.
- Gráficos (Recharts), importação/exportação CSV e testes E2E (Playwright) são
  próximos incrementos.
- Sync não gera snapshot de custo automático por impressão importada (recálculo
  manual/por ação); materiais importados do AMS ficam sem preço até correção.
- Convite de membros e edição de configurações da org: próxima iteração.
