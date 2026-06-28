# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.13-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/react/package.json packages/react/package.json
COPY packages/cli/package.json packages/cli/package.json
RUN bun install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:3002
ARG NEXT_PUBLIC_ERROR_TRACKER_DSN=
ARG NEXT_PUBLIC_ERROR_TRACKER_TOKEN=
ARG NEXT_PUBLIC_ERROR_TRACKER_SELF_MONITORING_ENABLED=false
ARG NEXT_PUBLIC_ERROR_TRACKER_ENVIRONMENT=production
ARG NEXT_PUBLIC_ERROR_TRACKER_RELEASE=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_ERROR_TRACKER_DSN=${NEXT_PUBLIC_ERROR_TRACKER_DSN}
ENV NEXT_PUBLIC_ERROR_TRACKER_TOKEN=${NEXT_PUBLIC_ERROR_TRACKER_TOKEN}
ENV NEXT_PUBLIC_ERROR_TRACKER_SELF_MONITORING_ENABLED=${NEXT_PUBLIC_ERROR_TRACKER_SELF_MONITORING_ENABLED}
ENV NEXT_PUBLIC_ERROR_TRACKER_ENVIRONMENT=${NEXT_PUBLIC_ERROR_TRACKER_ENVIRONMENT}
ENV NEXT_PUBLIC_ERROR_TRACKER_RELEASE=${NEXT_PUBLIC_ERROR_TRACKER_RELEASE}
COPY . .
RUN cd packages/sdk && bun run build
RUN cd apps/api && bun run build
RUN cd apps/web && bun run build

FROM node:22-alpine AS api-runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/package.json package.json
COPY --from=deps /app/bun.lock bun.lock
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=deps /app/apps/api/package.json apps/api/package.json
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/drizzle apps/api/drizzle
COPY --from=builder /app/apps/api/drizzle.config.ts apps/api/drizzle.config.ts
COPY scripts/docker/start-api.sh scripts/docker/start-api.sh
RUN chmod +x scripts/docker/start-api.sh

FROM api-runtime AS full-runtime
ENV HOSTNAME=0.0.0.0
COPY --from=deps /app/apps/web/node_modules apps/web/node_modules
COPY --from=deps /app/packages/sdk/node_modules packages/sdk/node_modules
COPY --from=deps /app/packages/react/node_modules packages/react/node_modules
COPY --from=deps /app/packages/cli/node_modules packages/cli/node_modules
COPY --from=deps /app/apps/web/package.json apps/web/package.json
COPY --from=deps /app/packages/sdk/package.json packages/sdk/package.json
COPY --from=deps /app/packages/react/package.json packages/react/package.json
COPY --from=deps /app/packages/cli/package.json packages/cli/package.json
COPY --from=builder /app/apps/web/.next apps/web/.next
COPY --from=builder /app/packages/sdk/dist packages/sdk/dist
COPY scripts/docker/start-full.sh scripts/docker/start-full.sh
RUN chmod +x scripts/docker/start-full.sh

FROM api-runtime AS api
EXPOSE 3002
CMD ["./scripts/docker/start-api.sh"]

FROM full-runtime AS full
EXPOSE 3002 3003
CMD ["./scripts/docker/start-full.sh"]
