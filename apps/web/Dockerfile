# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Dockerfile do app web (Next.js standalone) para o monorepo pnpm.
# Build a partir da RAIZ do repositório:
#   docker build -f apps/web/Dockerfile -t bambu-web .
# No Railway: serviço com Root Directory = "/" e Dockerfile Path = apps/web/Dockerfile
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps + build ---
FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
# Placeholders só para o build (o runtime recebe as envs reais do Railway).
ENV NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
ENV BAMBU_LIVE_ENABLED=false
RUN pnpm --filter @bambu/web build

# --- runner ---
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
