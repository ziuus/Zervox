# ==========================================
# Multi-Stage Dockerfile for Zervox UI
# Next.js 14 Standalone Output
# ==========================================

# Stage 1: Dependency install
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Bake in URLs at build time; can be overridden at runtime via env
ARG NEXT_PUBLIC_PRIMARY_URL=http://localhost:8080
ARG NEXT_PUBLIC_BACKUP_URL=http://localhost:8081
ARG NEXT_PUBLIC_POLL_INTERVAL_MS=3000

ENV NEXT_PUBLIC_PRIMARY_URL=$NEXT_PUBLIC_PRIMARY_URL
ENV NEXT_PUBLIC_BACKUP_URL=$NEXT_PUBLIC_BACKUP_URL
ENV NEXT_PUBLIC_POLL_INTERVAL_MS=$NEXT_PUBLIC_POLL_INTERVAL_MS
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Minimal runtime (standalone)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
