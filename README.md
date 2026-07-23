# Bambu Control

ERP simplificado para impressão 3D (foco Bambu Lab): importa o histórico de
impressões, calcula custos reais (material, energia, depreciação, manutenção,
mão de obra, falhas), organiza impressoras, filamentos, clientes, pedidos e
pagamentos, e mostra a **lucratividade real** por peça, pedido, cliente e período.

Multi-tenant (SaaS), pt-BR, **BRL**, timezone **America/Sao_Paulo** (configurável).

> Integração não oficial e independente. Bambu Control não é afiliado à Bambu Lab.

## Monorepo

```
apps/web        Next.js 15 (App Router) — front + API server-side
apps/worker     Worker de sincronização (cron)
packages/domain     Motor de custos PURO + normalização Bambu (+ testes)
packages/providers  PrinterProvider + mock/cloud + cripto + sync engine (+ testes)
packages/contracts  Schemas Zod compartilhados
packages/db         Tipos do banco + cliente admin (service_role)
packages/config     tsconfig base
supabase/           Migrations (RLS), seed e testes de RLS
docs/               Plano, ADR, motor de custos, segurança, deploy
```

## Stack

Next.js · TypeScript estrito · Tailwind · Supabase (Postgres + Auth + RLS) ·
Zod · Vitest · Turborepo/pnpm · Deploy no Railway.

## Começando

```bash
pnpm install
cp .env.example apps/web/.env.local   # preencher com seu Supabase
pnpm --filter @bambu/web dev          # http://localhost:3000
```

Banco: aplique `supabase/migrations/*.sql` (Supabase CLI `supabase db reset`
aplica migrations + `supabase/seed.sql`). Sem Supabase CLI, valide o SQL com
`scripts/db-test.sh` (Postgres local).

## Verificação

```bash
pnpm typecheck   # TS estrito em todos os pacotes
pnpm test        # Vitest: motor de custos, normalização, sync, cripto
pnpm build       # build do Next (19 rotas)
```

## Principais garantias

- **Sem float para dinheiro** — decimal BigInt (`packages/domain/src/money.ts`).
- **Custos imutáveis e versionados** — mudar preço atual não altera histórico.
- **Dado do provedor nunca sobrescrito** — padrão `provider_/manual_/effective_`.
- **Sync idempotente** — `unique(provider_connection_id, external_task_id)` + upsert.
- **Isolamento real por organização** — RLS + testes SQL.
- **Integração somente leitura** — sem comandos de controle da impressora.
- **Segredos só no back-end** — service_role e tokens nunca no browser.

## Documentação

- [Plano de implementação](docs/bambu-control-implementation-plan.md)
- [ADR — Integração por provedores](docs/architecture/provider-integration.md)
- [Motor de custos](docs/cost-engine.md)
- [Segurança](docs/security.md)
- [Deploy e operação](docs/deployment.md)

## Estado atual e limitações

Ver [CHANGELOG.md](CHANGELOG.md). Resumo: fundação, motor de custos, migrations/RLS,
providers, e app web (auth + fatia vertical de ponta a ponta) implementados e
verificados. A integração Bambu real (`bambu_cloud`) está atrás de
`BAMBU_LIVE_ENABLED` e usa fixtures no modo demo; gráficos, importação CSV e
E2E Playwright são os próximos incrementos.
