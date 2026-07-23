# Deploy (Railway) e Operação

## Visão geral

- **Supabase**: Postgres + Auth + RLS (gerenciado).
- **Railway**: dois serviços — `web` (Next.js) e `worker` (sync).

## 1. Supabase

1. Crie um projeto no Supabase.
2. Aplique as migrations (`supabase/migrations/*.sql`) na ordem:
   - Com Supabase CLI: `supabase db push` (ou `supabase db reset` em dev, que
     aplica migrations + `seed.sql`).
   - Ou rode os arquivos SQL em ordem no editor SQL.
3. (Opcional) rode `supabase/seed.sql` para dados de demonstração.
4. Copie `Project URL`, `anon key` e `service_role key`.

> As migrations criam RLS e helpers. O `_auth_shim.sql` em `supabase/tests/` é
> **apenas** para validação local sem Supabase (não aplicar em produção).

## 2. Railway — serviço `web`

- New Service → Deploy from repo.
- Root Directory: `/` · Dockerfile Path: `apps/web/Dockerfile` (há `apps/web/railway.json`).
- Variáveis de ambiente (ver `.env.example`):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CREDENTIALS_ENCRYPTION_KEY` (`openssl rand -base64 32`)
  - `BAMBU_LIVE_ENABLED=false` (ligar só com credenciais validadas)
  - `APP_DEFAULT_TIMEZONE=America/Sao_Paulo`, `APP_DEFAULT_CURRENCY=BRL`

## 3. Railway — serviço `worker`

- Root Directory: `/` · Dockerfile Path: `apps/worker/Dockerfile`.
- Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CREDENTIALS_ENCRYPTION_KEY`, `BAMBU_LIVE_ENABLED`, `BAMBU_REGION`,
  `SYNC_INTERVAL_MINUTES` (5–15).

## Desenvolvimento local

```bash
pnpm install
# banco: Supabase CLI (supabase start) OU Postgres local
cp .env.example apps/web/.env.local   # preencher
pnpm --filter @bambu/web dev          # http://localhost:3000
pnpm --filter @bambu/worker dev       # worker
```

Validar SQL sem Supabase CLI (Postgres local): `scripts/db-test.sh`.

## Verificação

```bash
pnpm typecheck      # TS estrito em todos os pacotes
pnpm test           # Vitest (domain + providers)
pnpm build          # build do Next
```

## Sincronização

- Manual: tela **Integrações → Sincronizar agora**.
- Automática: worker a cada `SYNC_INTERVAL_MINUTES`, com lock por conexão.
- `sync_runs` registra cada execução (recebidos/criados/atualizados/falhas, cursor).

## Solução de problemas

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Conexão vira `expired` | Token 401 | Reconectar; investigar renovação |
| `records_failed > 0` | Erro de gravação | Ver `sync_runs.error_message` e logs do worker |
| Nada sincroniza | `BAMBU_LIVE_ENABLED=false` sem conexão demo | Criar conexão demo ou ligar a flag com credenciais |
| Custo material 0 | Materiais sem preço/peso | Corrigir filamento/peso; recalcular |
| Margem `—` | Receita zero | Esperado (não é erro) |

## Checklist de produção

- [ ] RLS habilitada em todas as tabelas (verificar no Supabase).
- [ ] `service_role` e `CREDENTIALS_ENCRYPTION_KEY` apenas no back-end.
- [ ] `BAMBU_LIVE_ENABLED` só ligado após validar endpoints/credenciais reais.
- [ ] Backups do Postgres configurados no Supabase.
- [ ] Migrations aplicadas e `calculation_version` conferido.
- [ ] CI verde (typecheck, testes, build, migrations+RLS).
- [ ] Aviso de não-afiliação visível.
- [ ] Termos de uso / uso comercial da API revisados.
