ARG APEX_RELEASE_ID=unreleased
ARG APEX_COMMIT_SHA=unknown

FROM oven/bun:1.4.0-alpine AS builder
ARG APEX_RELEASE_ID
ARG APEX_COMMIT_SHA
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV APEX_RELEASE_ID=$APEX_RELEASE_ID
ENV APEX_COMMIT_SHA=$APEX_COMMIT_SHA

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:20-alpine AS runner
ARG APEX_RELEASE_ID
ARG APEX_COMMIT_SHA
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV APEX_RELEASE_ID=$APEX_RELEASE_ID
ENV APEX_COMMIT_SHA=$APEX_COMMIT_SHA
LABEL org.opencontainers.image.revision=$APEX_COMMIT_SHA
LABEL io.apex.release.id=$APEX_RELEASE_ID

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
