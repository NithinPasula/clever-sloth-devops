# syntax=docker/dockerfile:1
# Build context = REPO ROOT (needs the lockfile + workspace packages):
#   docker build -f apps/web/Dockerfile -t clever-sloth-web:dev .

# ---- Stage 1: install deps ---------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable

# Copy ONLY manifests first so `pnpm install` is cached until a manifest changes.
# Every workspace package.json that participates in the install must be present.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile

# ---- Stage 2: build ----------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
# Bring in the installed node_modules (incl. workspace symlinks) from `deps`...
COPY --from=deps /app ./
# ...then the actual source (node_modules is excluded via .dockerignore).
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time, so the API
# URL must be known here. Override per environment with:
#   docker build --build-arg NEXT_PUBLIC_API_URL=http://clever-sloth.local/api/v1 ...
ARG NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter web build

# ---- Stage 3: runtime --------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Unprivileged runtime user.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# The standalone output mirrors the monorepo layout from the tracing root:
#   .next/standalone/apps/web/server.js  + a minimal node_modules.
# Next does NOT copy static assets or /public into standalone — do it manually.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
