# Production image for the API (Bun + Elysia).
# Build from the repo root so workspace paths resolve:
#   docker build -f app/Dockerfile -t aggre-gator-api .
FROM oven/bun:1 AS base
WORKDIR /srv

# Manifests first for layer caching. The root bunfig.toml carries
# install.ignoreScripts (the metascraper re2 native build must stay off).
COPY bun.lock package.json bunfig.toml ./
COPY app/package.json app/bunfig.toml ./app/
RUN bun install --frozen-lockfile --production --filter app

# Runtime source. `shared/` is imported via relative path (collection-tree),
# `drizzle/` ships the migrations the deploy step applies.
COPY app/src ./app/src
COPY app/drizzle ./app/drizzle
# TrueType fonts for the Open Graph renderer. Satori cannot read the woff2 files
# in client/public/fonts, so the OG weights are vendored here — see
# app/assets/fonts/README.md. Rendering a preview card is not optional, so a
# missing directory must fail the build rather than surface as a 500 later.
COPY app/assets ./app/assets
COPY shared ./shared

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
WORKDIR /srv/app
# Healthcheck. The program is single-quoted on purpose: shell form runs
# /bin/sh -c, and the JS template literal's backticks inside double quotes
# get command-substituted by sh — the check then fails on a healthy server
# (verified: exit 1 live, exit 1 dead). Single quotes pass it to bun intact.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e 'if (!await fetch(`http://localhost:${process.env.PORT || 3001}/health`).then((r) => r.ok).catch(() => false)) process.exit(1)'
CMD ["bun", "src/index.ts"]
