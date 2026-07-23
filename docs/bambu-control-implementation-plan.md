# Bambu Control — Plano de Implementação

## Arquitetura encontrada

Repositório **greenfield** (vazio no início). Não havia front-end nem back-end
prévios, nem repositório de back-end separado — a decisão foi **monorepo único**
para deploy no Railway. Portanto adotamos os defaults do prompt.

## Stack adotada

- **Monorepo**: Turborepo + pnpm.
- **Front + API**: Next.js 15 (App Router) + TypeScript estrito + Tailwind + React 19.
- **Banco + Auth**: Supabase (Postgres + Auth + RLS). Apps no Railway.
- **Worker**: serviço Node (tsx) para sincronização periódica.
- **Domínio**: pacotes puros e testáveis (motor de custos, normalização).

### Pacotes

| Pacote | Responsabilidade |
|--------|------------------|
| `@bambu/domain` | Motor de custos PURO, dinheiro em BigInt, normalização Bambu, fixtures |
| `@bambu/providers` | Abstração `PrinterProvider`, mock/cloud Bambu, cripto de credenciais, motor de sync idempotente |
| `@bambu/contracts` | Schemas Zod compartilhados (validação de payloads) |
| `@bambu/db` | Tipos do banco (Database) + cliente admin (service_role) |
| `@bambu/config` | tsconfig base compartilhado |
| `apps/web` | Next.js: auth, telas, API server-side, serviços |
| `apps/worker` | Sincronização automática (cron) |

## Arquivos relevantes

- `packages/domain/src/cost-engine/` — fórmulas e `computeCostBreakdown`
- `packages/domain/src/normalize/` — `normalizeBambuTask`
- `packages/providers/src/{sync-engine,crypto,bambu-mock,bambu-cloud}.ts`
- `supabase/migrations/*.sql` — schema + RLS + índices
- `apps/web/lib/services/{cost,sync}.ts` — composição domínio+banco
- `apps/web/app/(app)/**` — telas ligadas a dados reais

## Fatos

- Postgres com RLS isola organizações (validado por testes SQL).
- Motor de custos determinístico, sem float (BigInt), versionado — validado por 20 testes.
- Normalização Bambu defensiva — validada por 18 testes com fixtures.
- Sync idempotente (unique + upsert + dedup) — validado por testes.
- App Next.js builda (19 rotas) e passa typecheck estrito.

## Hipóteses (a validar com credenciais reais)

- Endpoints/host regional da Bambu Cloud (`/v1/user-service/my/tasks`, `/v1/iot-service/api/user/bind`).
- Semântica de `weight` (peso informado/estimado) e `costTime` (não necessariamente tempo real).
- Formato do `amsDetailMapping`, códigos de status, paginação e rate limit.
- Fluxo de autenticação (código de verificação, 2FA, renovação de token).

Todas tratadas como **desconhecidas**: payload bruto preservado, fallback seguro,
feature flag `BAMBU_LIVE_ENABLED`, testes de contrato com fixtures.

## Decisões

- Integração **somente leitura** no MVP; sem comandos de controle da impressora.
- Provedores no MVP: `manual` + `bambu_cloud` (mock por padrão; HTTP real atrás de flag).
- Custos como **snapshots imutáveis versionados**; preço atual não altera histórico.
- Padrão `provider_/manual_/effective_` para não sobrescrever dado importado.
- Credenciais criptografadas (AES-256-GCM) server-side; senha descartada após auth.

## Riscos

- API Bambu instável/não-oficial (mitigado por abstração + flag + fixtures).
- Termos de uso / uso comercial da API — aviso de não-afiliação exibido; validar antes de comercializar.
- `numeric` do PostgREST pode vir como string — tratado com coerção/Zod.

## Fases de implementação (executadas)

0. Fundação do monorepo · 1. Motor de custos + normalização · 2. Migrations + RLS ·
3. Providers + contracts + db · 4. App web (auth + fatia vertical) ·
5. Worker + deploy + docs + CI.

## Estratégia de rollback

- Migrations versionadas e aditivas; cada mudança de fórmula incrementa
  `calculation_version` sem reescrever snapshots.
- `BAMBU_LIVE_ENABLED=false` desliga a integração real instantaneamente.
- Deploy por serviço no Railway permite voltar ao release anterior.
- Nenhuma operação destrutiva automática; exclusões financeiras preferem
  cancelamento/arquivamento.
