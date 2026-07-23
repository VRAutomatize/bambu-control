# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Dockerfile do worker de sincronização. Build a partir da RAIZ do repositório:
#   docker build -f apps/worker/Dockerfile -t bambu-worker .
# No Railway: serviço com Root Directory = "/" e Dockerfile Path = apps/worker/Dockerfile
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app ./
USER node
# tsx executa a fonte TS diretamente (sem passo de build).
CMD ["pnpm", "--filter", "@bambu/worker", "start"]
