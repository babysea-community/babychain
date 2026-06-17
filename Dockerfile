# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_SITE_URL=https://babychain.example.com
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm build

FROM base AS prod-deps
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/app ./app
COPY --chown=node:node --from=build /app/components ./components
COPY --chown=node:node --from=build /app/instrumentation-client.ts ./instrumentation-client.ts
COPY --chown=node:node --from=build /app/instrumentation.ts ./instrumentation.ts
COPY --chown=node:node --from=build /app/lib ./lib
COPY --chown=node:node --from=build /app/next.config.ts ./next.config.ts
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/styles ./styles
COPY --chown=node:node --from=build /app/tsconfig.json ./tsconfig.json

USER node
EXPOSE 3000
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
