# Bambu Control — Quick Start Deploy

Seu sistema está pronto para deploy em produção! Este é um resumo executivo dos passos.

---

## O que foi feito

✅ **Banco de dados**: 8 migrations SQL testadas, sem erros
✅ **Authentication**: Fluxo de login/signup/invite corrigido e completo
✅ **TypeScript**: Typecheck 100% limpo (7 packages)
✅ **Deployment**: Documentação completa em `DEPLOYMENT.md`
✅ **Scripts**: `build-consolidated-sql.sh` para deploy via GUI

---

## Para fazer deploy agora (5 passos)

### 1️⃣ Criar projeto Supabase em produção (2 minutos)

```
https://supabase.com/dashboard → New Project
```

Salve as 3 chaves:
- `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public)
- `SUPABASE_SERVICE_ROLE_KEY` (service_role, guardar em segredo!)

### 2️⃣ Aplicar migrations (1 minuto)

No Supabase Dashboard:

```
SQL Editor → New Query → Cole conteúdo de supabase/consolidated.sql → Run
```

Você deve ver 19 tabelas criadas em **Database → Tables**.

### 3️⃣ Criar account Railway (2 minutos)

```
https://railway.app → Login com GitHub → New Project
```

### 4️⃣ Configurar 2 serviços em Railway (5 minutos)

**Serviço 1: Web (Next.js)**
- Conectar repositório GitHub: `vrautomatize/bambu-control`
- Build Command: `pnpm install && pnpm build`
- Start Command: `pnpm start`
- Adicionar variáveis de ambiente (ver passo 5)

**Serviço 2: Worker (sync/cron)**
- Mesmo repositório
- Root Directory: `apps/worker`
- Build Command: `pnpm install --filter=worker && pnpm --filter=worker build`
- Start Command: `pnpm --filter=worker start`
- Mesmas variáveis de ambiente

### 5️⃣ Variáveis de ambiente (Railway)

Para **ambos** os serviços (copie/cole em Railway → Variables):

```ini
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres:senha@db.seu-project.supabase.co:5432/postgres

# Encryption (gere com: openssl rand -base64 32)
CREDENTIALS_ENCRYPTION_KEY=sua-chave-32-bytes

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

---

## Depois do deploy (teste)

### ✅ Verificar saúde da web

```bash
curl https://seu-dominio.railway.app/api/health
```

### ✅ Testar fluxo completo

1. Acesse https://seu-dominio.railway.app
2. Clique **Criar conta**
3. Confirme email (Supabase enviará)
4. Faça login
5. Crie uma organização
6. Pronto! Sistema pronto.

### ✅ Monitorar logs

- Web logs: Railway → web service → **View Logs**
- Worker logs: Railway → worker service → **View Logs**
- DB errors: Supabase → **Logs**

---

## Documentação completa

Consulte `DEPLOYMENT.md` para:
- Setup local com Supabase (desenvolvimento)
- Configuração completa de cada serviço Railway
- Domain customizado (apontar seu domínio)
- Troubleshooting de erros comuns
- Checklist pré-produção completo

---

## Comandos úteis (local)

```bash
# Testar local com Supabase simulado
supabase start
pnpm dev

# Build para produção
pnpm build

# Ver migrations
cat supabase/consolidated.sql | wc -l

# Gerar encryption key nova
openssl rand -base64 32
```

---

## ⚠️ IMPORTANTE — Segredos

**NUNCA comitar:**
- `.env.local` com chaves reais
- `SUPABASE_SERVICE_ROLE_KEY` no repositório
- `CREDENTIALS_ENCRYPTION_KEY` no repositório

Em Railway, use **Variables** para secrets. Supabase não conhece as chaves — elas vivem só em Railway.

---

## Status da implementação

| Componente | Status | Notas |
|------------|--------|-------|
| Banco de dados (Postgres 16) | ✅ Pronto | 19 tabelas + RLS |
| Auth (Supabase) | ✅ Pronto | Email + social (opcional) |
| Web (Next.js) | ✅ Pronto | Dashboard + telas admin |
| Worker (cron/sync) | ✅ Pronto | Node.js, sync impressoras |
| Integração Bambu | 🟡 Mock | Live atrás de `BAMBU_LIVE_ENABLED` flag |
| CSV import | ✅ Estrutura | Interface pronta |
| Relatórios | 🟡 Dashboard básico | Expandir com Recharts/filtros |

---

**Tempo estimado total: ~20 minutos do zero ao ar.**

Qualquer dúvida, consulte `DEPLOYMENT.md` ou rode `pnpm dev` localmente e teste primeiro.

---

**Versão**: 1.0  
**Data**: 27 de julho de 2026  
**Status**: Pronto para produção
