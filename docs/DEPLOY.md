# Deploying Aggregator

One web service on [Render](https://render.com)'s free plan plus a free
[Neon](https://neon.tech) Postgres database. Total cost: $0. The API serves the
built SPA from the same origin (no nginx, no TLS setup — Render terminates
HTTPS), so a deploy is one container image and one environment variable.

Related: `render.yaml` (the blueprint), `Dockerfile` (the single-service
image), `app/src/utils/client-spa.ts` (how one process serves both the API and
the SPA), `docs/decisions/002-public-page-rendering.md` (why crawler routing
exists).

## What runs where

```
                    ┌─ Render web service (free) ─────────────┐
browsers ── https ──►  Bun API: JSON + SPA + crawler HTML + OG │
                    │  images, migrations run on boot          │
                    └───────────────┬─────────────────────────┘
                                    │ postgres over TLS
                                    ▼
                          Neon Postgres (free tier)
```

Free-tier behavior to expect:

- **The service sleeps after ~15 minutes without traffic and takes about a
  minute to wake.** The first visitor after an idle stretch waits; everyone
  after that is instant. Link previews from social platforms also wake it —
  the first unfurl after idle may time out on the platform's side.
- Neon's free tier scales the database to zero when idle; the first query
  after idle pays a short cold start (typically well under the service's own
  wake time).
- No email yet: password-reset links are printed to the service log until the
  mail provider lands (see `docs/TASKS.md`).

## First deploy

1. **Create the Neon database.** Sign up at neon.tech → New project → copy the
   **pooled** connection string (`...neon.tech/aggregator?sslmode=require`).
   The pooled endpoint matters: the API opens a fresh pool per cold start and
   Neon's pooler absorbs that without burning connection slots.

2. **Get the code onto Render.** Push this repo to GitHub, then in Render:
   New → **Blueprint** → pick the repo. Render reads `render.yaml` and creates
   one web service from `Dockerfile` on the free plan. When asked for
   `DATABASE_URL` (marked *sync: false* in the blueprint), paste the Neon
   string. `BETTER_AUTH_SECRET` is generated for you and persists across
   deploys.

   No GitHub? New → Web Service → *Deploy an existing image* or connect a
   public Git URL works too — the blueprint is a convenience, not a
   requirement.

3. **Wait for the first deploy.** The image build runs the client build and
   the API install; on boot the container applies pending migrations
   (`app/scripts/migrate.ts`) and only then starts serving. Render's health
   check (`/health`) gates the rollout.

4. **Verify.** `https://<service>.onrender.com/health` → JSON. Open the app,
   sign up, publish a collection, and paste a public link into
   [opengraph.xyz](https://www.opengraph.xyz) or Slack to confirm the preview
   card renders.

`CLIENT_URL` and `BETTER_AUTH_URL` are derived from Render's
`RENDER_EXTERNAL_URL` at runtime (`app/src/env.ts`), so the default
`*.onrender.com` hostname needs no configuration.

## Custom domain (needed before Dodo Payments)

Render free services can attach a custom domain at no cost:

1. Add a CNAME record at your registrar: `www` (or the apex, via their ALIAS
   record) → `<service>.onrender.com`.
2. Render dashboard → the service → Settings → Custom Domains → add the
   domain. TLS is issued automatically.
3. Set `CLIENT_URL` and `BETTER_AUTH_URL` on the service to the new origin
   (they no longer derive from `RENDER_EXTERNAL_URL` once set explicitly) and
   redeploy. Better-auth's `trustedOrigins` and CORS both follow `CLIENT_URL`.

Dodo Payments (phase 6) needs a reachable `https://` webhook URL — the
`*.onrender.com` hostname already satisfies that, but the branded checkout and
webhook allow-lists are cleaner with the custom domain, so do this before
starting phase 6.

## Day-to-day

- **Ship:** push to the connected branch; Render rebuilds and rolls out
  automatically (`autoDeploy: true` in the blueprint). Migrations apply on
  boot — they are additive by convention (`docs/TASKS.md`), so no separate
  migration step exists.
- **Logs:** Render dashboard → Logs. Password-reset URLs appear there until
  email lands.
- **Wake-ups:** if the service must feel always-on (demo day, webhook tests),
  any uptime pinger pointed at `/health` keeps it awake within the free
  plan's 750 instance-hours.

## Self-hosted alternative

The split images (`app/Dockerfile` + `client/Dockerfile`, nginx in front with
the crawler routing from `client/nginx.conf`) remain for a VPS deployment;
compose for that path was prototyped and set aside — revive it from git
history (`git log --follow client/nginx.conf`) if a VPS ever becomes
preferable to Render's free tier.
