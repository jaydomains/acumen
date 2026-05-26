# Acumen frontend container (AC-CD19). Multi-stage: deps → builder →
# runner. Mirrors the backend Dockerfile's leaf-stage discipline.
#
# `output: 'standalone'` in next.config.ts means the runner stage only
# needs the minimal .next/standalone/ bundle plus the .next/static
# assets and the public/ folder — no full pnpm install at runtime.

# ---- deps: install with the frozen lockfile -------------------------
FROM node:22-slim AS deps
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---- builder: compile the Next.js app -------------------------------
# No NEXT_PUBLIC_* envs are injected here. Runtime config (e.g. the
# backend URL) is fetched at boot via /api/config so the same image
# can be deployed against any backend without a rebuild (multi-tenant).
FROM node:22-slim AS builder
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- runner: minimal image with the standalone bundle ---------------
FROM node:22-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --shell /sbin/nologin nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
