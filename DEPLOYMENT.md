# Bambu Control — Guia de Deploy

## Visão Geral

Este documento detalha todos os passos necessários para fazer deploy do Bambu Control em produção. O sistema é um **monorepo Turborepo** com:

- **apps/web**: Next.js 15 fullstack (App Router, server actions, auth)
- **apps/worker**: Node.js worker para sync/cron de impressoras
- **packages/***: Bibliotecas compartilhadas (domain, providers, db, contracts, config)

**Stack:**
- Backend: Supabase (PostgreSQL 16 + Auth + RLS)
- Frontend: Next.js 15 + Tailwind + shadcn/ui
- Deploy: Railway (docker, dois serviços)
- Linguagem: TypeScript

---

## Fase 0: Preparação local (desenvolvimento)

### 1. Clonar e instalar

```bash
git clone https://github.com/vrautomatize/bambu-control.git
cd bambu-control
pnpm install
```

### 2. Configurar Supabase local (para teste)

```bash
# Assumindo supabase-cli instalado
supabase start
# Isso inicia PostgreSQL 16, Auth e sandbox local em localhost:54321
```

### 3. Criar arquivo `.env.local` (nunca commitar com valores reais)

```bash
cp .env.example .env.local
```

**Preencher com valores de teste local:**

```ini
# Supabase local
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # anon key do supabase start

# Service role (NUNCA expor; server-side only)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # service_role do supabase start

# Direct DB connection (worker/migrations)
SUPABASE_DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Encryption key para credenciais (32 bytes base64)
CREDENTIALS_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Bambu Cloud (desligado por padrão em dev)
BAMBU_LIVE_ENABLED="false"
BAMBU_REGION="global"

# Padrões
APP_DEFAULT_TIMEZONE="America/Sao_Paulo"
APP_DEFAULT_CURRENCY="BRL"

# URL pública (em dev, pode ser localhost)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Worker
SYNC_INTERVAL_MINUTES="10"
```

### 4. Aplicar migrations ao banco local

**Opção A: Via Supabase CLI (recomendado em dev)**

```bash
supabase db reset
# Isso aplica todas as migrations em supabase/migrations/ na ordem correta
```

**Opção B: Manual via SQL Editor (se preferir)**

```bash
# Copiar conteúdo completo de supabase/consolidated.sql
# Ir para http://localhost:54321 → SQL Editor → colar e executar
cat supabase/consolidated.sql
```

### 5. Verificar setup local

```bash
# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Testes (vitest)
pnpm test

# Build local
pnpm build

# Dev server (Next.js + worker sim)
pnpm dev
# Acessar http://localhost:3000
```

---

## Fase 1: Setup Supabase em Produção

### 1. Criar projeto no Supabase

1. Ir para https://supabase.com/dashboard
2. Clique em "New project"
3. Preencha:
   - **Organization**: Selecione sua org
   - **Project Name**: `bambu-control-prod`
   - **Database Password**: Gere uma senha forte (guardar em lugar seguro)
   - **Region**: Escolha a mais perto (ex.: `us-east-1` ou `sa-east-1` para Brasil)
4. Aguarde ~1 minuto para o projeto ficar pronto

### 2. Copiar chaves do projeto

No dashboard Supabase, vá para **Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL` → Copie **Project URL**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Copie **anon public**
- `SUPABASE_SERVICE_ROLE_KEY` → Copie **service_role** (MANTER EM SEGREDO)
- `SUPABASE_DB_URL` → Vá para **Database → Connection Pooling** e copie a string com `pgbouncer` (ou a URL direta do banco)

### 3. Aplicar migrations

**Opção A: Via Supabase CLI (rápido)**

```bash
export SUPABASE_ACCESS_TOKEN="seu-token"  # Gere em https://supabase.com/dashboard/account/tokens
supabase link --project-ref seu-project-ref
supabase db push
```

**Opção B: Via SQL Editor (GUI, sem CLI)**

1. Ir para https://supabase.com/dashboard/project/seu-project-ref/sql/new
2. Copie o conteúdo **completo** de `supabase/consolidated.sql`:
   ```bash
   cat supabase/consolidated.sql
   ```
3. Cole no SQL Editor do Supabase
4. Clique **Run**
5. Aguarde (pode levar ~30s). Você deve ver "Query successful" sem erros.

**Verificar:** Vá para **Database → Tables** — deve haver 19 tabelas (organizations, organization_members, profiles, machine_cost_profiles, provider_connections, printers, filaments, spools, print_jobs, print_job_materials, print_cost_snapshots, customers, orders, order_items, order_item_print_jobs, payments, sync_runs, audit_logs, organization_invites).

### 4. Configurar Auth no Supabase

1. Vá para **Authentication → Providers**
2. **Email**: Já vem habilitado por padrão
3. (Opcional) **Google, GitHub, etc.**: Ativar se quiser; requer OAuth keys

Para auth por email (recomendado para MVP):
- Ir para **Authentication → Email Templates**
- Verificar que "Confirm signup" está habilitado
- (Opcional) Personalizar template de confirmação

### 5. Configurar JWT secret

1. Vá para **Settings → API**
2. Copie o **JWT Secret**
3. **GUARDAR**: Você vai precisar em Railway (não colocar em `.env` local)

---

## Fase 2: Setup Railway para Produção

Railway é o serviço de deploy. Você vai criar **2 serviços**: um para a web (Next.js) e um para o worker (sync/cron).

### 1. Criar conta Railway

1. Vá para https://railway.app
2. Faça login com GitHub
3. Crie um novo projeto

### 2. Configurar serviço Web (Next.js)

#### A. Conectar repositório

1. No dashboard Railway: **+ Create** → **GitHub Repo**
2. Selecione `vrautomatize/bambu-control`
3. Autorize Railway a acessar o repositório

#### B. Configurar build & start

Railway vai detectar `package.json` e usar Nixpacks. Precisamos customizar:

1. No serviço **web**, clique em **Settings**
2. **Root Directory**: deixe vazio (raiz do monorepo) — **não** aponte para `apps/web`,
   senão o pnpm workspace não resolve os pacotes `@bambu/*`
3. **Build Command**:
   ```
   pnpm install --frozen-lockfile && pnpm build
   ```
4. **Start Command**:
   ```
   pnpm start:web
   ```
   ⚠️ **Não** use `pnpm start` — não existe esse script na raiz do monorepo, e o
   Railway vai falhar com `ERR_PNPM_NO_SCRIPT_OR_SERVER Missing script start or file
   server.js`. O script `start:web` (definido no `package.json` raiz) roda
   `pnpm --filter=@bambu/web start`, que é o `next start` de fato.

#### C. Variáveis de ambiente (web)

1. No serviço **web**, clique em **Variables**
2. Adicione:

```ini
# Supabase (públicas)
NEXT_PUBLIC_SUPABASE_URL=https://seu-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase (privadas, server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres:senha@db.seu-project.supabase.co:5432/postgres

# Encryption
CREDENTIALS_ENCRYPTION_KEY=seu-32-bytes-base64

# App config
APP_DEFAULT_TIMEZONE=America/Sao_Paulo
APP_DEFAULT_CURRENCY=BRL
NEXT_PUBLIC_APP_URL=https://seu-dominio.railway.app

# Bambu (desligado em prod por padrão)
BAMBU_LIVE_ENABLED=false
BAMBU_REGION=global

# Worker
SYNC_INTERVAL_MINUTES=10
```

#### D. Port

1. Em **Settings → Port**:
   - Confirme que está em `3000` (Next.js default)

#### E. Deploy

1. Volte para **Deployments**
2. Railway vai começar a fazer build automaticamente
3. Quando ficar **green** (indica sucesso), clique no link público para testar

---

### 3. Configurar serviço Worker (Node.js + cron)

#### A. Criar novo serviço

1. No projeto Railway, clique **+ Create Service**
2. Selecione **GitHub Repo** → mesmo repo

#### B. Customizar para worker

1. No serviço **worker**, vá para **Settings**
2. **Root Directory**: deixe vazio (raiz do monorepo, mesmo motivo do serviço web)
3. **Build Command**:
   ```
   pnpm install --frozen-lockfile
   ```
   O worker roda TypeScript direto via `tsx` (sem etapa de build/transpile), então
   não precisa de `pnpm build` aqui.
4. **Start Command**:
   ```
   pnpm start:worker
   ```
   O script `start:worker` roda `pnpm --filter=@bambu/worker start`. (O pacote se
   chama `@bambu/worker`, não `worker` — usar o filtro errado também quebra o deploy.)

#### C. Variáveis de ambiente (worker)

Mesmas do serviço web (Railway compartilha por padrão, ou adicione manualmente):

```ini
NEXT_PUBLIC_SUPABASE_URL=https://seu-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres:senha@db.seu-project.supabase.co:5432/postgres
CREDENTIALS_ENCRYPTION_KEY=seu-32-bytes-base64
SYNC_INTERVAL_MINUTES=10
```

#### D. Deploy

1. Railway vai fazer build e start do worker
2. Verifique logs em **Deployments** → **View Logs**

---

## Fase 3: Verificação e testes pós-deploy

### 1. Health check da web

```bash
curl https://seu-dominio.railway.app/api/health
# Esperado: {"status":"ok"} (se implementado) ou erro 404 (normal)
```

### 2. Testar fluxo de signup → criar org

1. Acesse https://seu-dominio.railway.app
2. Clique em **Criar conta**
3. Preencha email e senha
4. Confirme email (Supabase enviará um link)
5. Após confirmado, faça login
6. Crie uma organização (se houver tela)

### 3. Testar invite

Se a feature de convite estiver implementada:

1. Após criar org, vá em **Configurações → Membros**
2. Convide um colega com email
3. Supabase enviará email com link `/accept-invite?code=TOKEN`
4. Confirme que link funciona

### 4. Logs e debugging

Se algo quebrar:

- **Web logs**: Railway → web service → **View Logs**
- **Worker logs**: Railway → worker service → **View Logs**
- **DB logs**: Supabase → **Logs** → **PostgreSQL** (RLS errors, migrations)

---

## Fase 4: Domínio personalizado (opcional mas recomendado)

### 1. Apontar domínio para Railway

1. No Railway, na aba **Settings** do projeto, vá para **Domains**
2. Clique **+ Add Custom Domain**
3. Digite `seu-dominio.com` ou `app.seu-dominio.com`
4. Railway fornecerá um CNAME:
   ```
   seu-dominio.com CNAME gateway.railway.app
   ```
5. Adicione o CNAME no DNS da sua registradora (ex: Namecheap, Route 53)
6. Aguarde ~5 min para propagar

### 2. Certificado HTTPS

Railway provê certificado Let's Encrypt automaticamente após o CNAME estar correto.

---

## Fase 5: Backups e monitoramento

### Backups do Supabase

1. Vá para Supabase **Database → Backups**
2. Ative backups automáticos (default: daily)
3. Download manual sempre disponível

### Alertas Railway

1. Em Railway, em cada serviço, configure **Alerts** se desejar notificações por email
2. (Recomendado) Monitorar deployments falhados

---

## Troubleshooting

### Erro: "column reference ... is ambiguous"

**Causa**: Migration 0007 tinha syntax SQL inválido.
**Solução**: Já corrigido neste repositório. Se estiver usando uma versão antiga, aplique patch:

```sql
-- Remove constraint inválido
ALTER TABLE public.organization_invites DROP CONSTRAINT IF EXISTS unique_pending_invite;

-- Crie índice único parcial (correto)
CREATE UNIQUE INDEX unique_pending_invite
  ON public.organization_invites (organization_id, email)
  WHERE accepted_at IS NULL;
```

### Erro: `ERR_PNPM_NO_SCRIPT_OR_SERVER Missing script start or file server.js`

**Causa**: O Start Command do serviço no Railway está configurado como `pnpm start`
(ou o **Root Directory** aponta para `apps/web`/`apps/worker`), e não existe script
`start` na raiz do monorepo.
**Solução**:
- Serviço web → Start Command: `pnpm start:web`
- Serviço worker → Start Command: `pnpm start:worker`
- Root Directory de ambos os serviços: **vazio** (raiz do repo)

### Erro: "missing or invalid code"

**Causa**: Middleware estava redirecionando `/accept-invite?code=...` para `/login` antes do handler processar.
**Solução**: Já corrigido. Confirme que `apps/web/middleware.ts` tem `'/accept-invite'` em `PUBLIC_PATHS`.

### Erro: "auth.uid() is null in RPC"

**Causa**: Usuário não autenticado ou session expirada.
**Solução**: Testar com usuário logado; confirmar que JWT é válido.

### Worker não sincroniza

1. Confirme que `SUPABASE_DB_URL` está correto
2. Verifique logs em Railway: `pnpm --filter=@bambu/worker dev` localmente
3. Confirme que `SYNC_INTERVAL_MINUTES` não é 0

---

## Commit e Push

Após tudo pronto, commit todas as mudanças:

```bash
git add .
git commit -m "Deploy: Add migrations fixes, auth flow, and deployment guide

- Fix migration 0007: Change unique constraint to partial unique index
- Fix RPC return type: organization_id → org_id (ambiguity resolution)
- Fix auth flow: Preserve ?next parameter through login/signup/invite
- Move accept-invite route: (app) → root (public, no requireAuth)
- Add NEXT_PUBLIC_APP_URL to .env.example for invite links
- Add build-consolidated-sql.sh script for single-file SQL deploy
- Add DEPLOYMENT.md: Complete Railway + Supabase setup guide"

git push -u origin claude/bambu-control-full-system-yc4pvk
```

---

## Checklist pré-produção

- [ ] Todas as migrations aplicam sem erro: `pnpm typecheck && pnpm test`
- [ ] Build local sucede: `pnpm build`
- [ ] `.env.local` está em `.gitignore` (nunca commitar com secrets)
- [ ] Supabase project criado em produção
- [ ] Railway account criado e projetos configurados
- [ ] Variáveis de ambiente adicionadas em ambos os serviços (web + worker)
- [ ] Domínio personalizado apontando para Railway (CNAME)
- [ ] Email Supabase configurado (SMTP provider, templates)
- [ ] Signup → confirm email → login → create org fluxo testado em produção
- [ ] Invite accept testado (gerar token, clicar link, aceitar)
- [ ] Logs monitorizados em Railway
- [ ] Backups automáticos ligados no Supabase

---

## Documentação adicional

- **Cost engine**: `docs/cost-engine.md`
- **Provider integration**: `docs/architecture/provider-integration.md`
- **Security & RLS**: `docs/security.md`
- **Architecture overview**: Root `README.md`

---

**Versão**: 1.0  
**Data**: 27 de julho de 2026  
**Status**: Pronto para deploy em produção
