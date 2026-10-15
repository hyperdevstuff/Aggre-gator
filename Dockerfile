# Single-service production image: the API serves the built SPA from the same
# origin (CLIENT_DIST_DIR), so one small web service hosts everything — this is
# what deploys to Render (docs/DEPLOY.md). TLS and the public hostname are the
# platform's. The split images (app/Dockerfile + client/Dockerfile behind
# nginx) remain for self-hosted deploys.
#
# Build from the repo root:
#   docker build -t aggre-gator .
FROM oven/bun:1 AS client-build
WORKDIR /srv
COPY bun.lock package.json bunfig.toml ./
COPY client/package.json ./client/
COPY shared ./shared
RUN bun install --frozen-lockfile --filter aggregator
COPY client ./client
WORKDIR /srv/client
# Empty string = the SPA calls the API on its own origin, which is exactly the
# single-process layout. Never leave this at the localhost default.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

FROM oven/bun:1
WORKDIR /srv
COPY bun.lock package.json bunfig.toml ./
COPY app/package.json app/bunfig.toml ./app/
RUN bun install --frozen-lockfile --production --filter app

COPY app/src ./app/src
COPY app/drizzle ./app/drizzle
COPY app/scripts ./app/scripts
COPY app/assets ./app/assets
COPY shared ./shared
COPY --from=client-build /srv/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3001
ENV CLIENT_DIST_DIR=/srv/client/dist
EXPOSE 3001
WORKDIR /srv/app

# Healthcheck. The program is single-quoted on purpose: shell form runs
# /bin/sh -c, and the JS template literal's backticks inside double quotes
# get command-substituted by sh — the check then fails on a healthy server
# (verified: exit 1 live, exit 1 dead). Single quotes pass it to bun intact.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e 'if (!await fetch(`http://localhost:${process.env.PORT || 3001}/health`).then((r) => r.ok).catch(() => false)) process.exit(1)'

# Migrations are additive by convention (docs/TASKS.md), so running them on
# boot is safe; drizzle-kit is a devDependency and not in this image, which is
# why the migrator lives in scripts/migrate.ts.
CMD ["sh", "-c", "bun scripts/migrate.ts && bun src/index.ts"]
