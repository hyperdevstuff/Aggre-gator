# ADR-002 — Public pages: crawler-served HTML, not full SSR

> Status: **accepted** · Date: 2026-10-07 · **Implemented** 2026-10-12 ·
> Relates to `ROADMAP.md` Phase 3

## Context

Public pages (`/share/:code` today, `/u/:name` and `/u/:name/:slug` in phase 3)
are rendered entirely in the browser. Social crawlers — Slack, Discord, Twitter/X,
LinkedIn, iMessage — fetch the HTML and **do not execute JavaScript**. Every
shared link therefore previews as the generic app shell, or as nothing.

The two options on the table were:

- **A. Move public routes to SSR** with TanStack Start (full-document SSR,
  streaming, server functions).
- **B. Have the backend render the meta tags** for crawler requests, and leave
  the SPA alone.

## Decision

**B — serve crawler-specific HTML from the API. Do not adopt TanStack Start.**

## Why not TanStack Start

The research is unambiguous about maturity: as of the current release line,
Start is a **Release Candidate**, not 1.0. Its own docs carry the RC badge, and
the team recommends locking dependency versions rather than tracking a range.
RSC support is experimental opt-in. That is not disqualifying by itself — real
products run on it — but it carries a specific risk here.

We are already on `@tanstack/react-router` 1.170 with the router plugin and a
generated `routeTree.gen.ts`. Adopting Start means taking a framework that is
not stable, converting an existing working app to it, and **changing the
deployment model**: `client/Dockerfile` currently builds to static files served
by nginx with `try_files … /index.html`. SSR replaces that with a long-running
Bun server — a different image, a different health check, a different scaling
story, and a persistent container where today there is none.

That is a large, risky change to make **before** the first public page exists.
We would be paying the migration cost against a feature we have not built, and
then pay it again when phase 3 lands.

And Start solves a problem we do not have. We do not need SSR for *speed* — the
pages are public reads behind a rate limiter, and the client already has the
whole page model working. We need **HTML in `<head>` for crawlers**. That is a
few tags, not a rendering pipeline.

## What we build instead

Two pieces, both on the API side, neither touching the SPA:

**1. Crawler HTML.** On `GET /share/:code`, `/u/:username`, `/u/:username/:slug`,
detect a crawler by `User-Agent` (Twitterbot, Slackbot, Discordbot,
facebookexternalhit, TelegramBot, WhatsApp, LinkedInBot, and a generic
allowlist/regex fallback). For a crawler, respond `200 text/html` with a small
document carrying `og:title`, `og:description`, `og:image`, `og:url`,
`twitter:card=summary_large_image`, `og:type`, `og:site_name`, and a
`<link rel="canonical">`. For everyone else, respond exactly as today — the SPA
path is untouched.

Prefer reusing the **existing** `links` canonical or `og:image` from the page if
we have it, and fall back to a generated card.

**2. OG image generation.** Render 1200×630 cards with `satori` (JSX → SVG) plus
`@resvg/resvg-wasm` (SVG → PNG), served from an API route such as
`/og/collection/:shareCode.png`, cached hard
(`public, max-age=86400, stale-while-revalidate=43200`) since they are fetched by
platforms, rarely by users.

Two traps worth writing down now, both from people who hit them:

- **Satori is flexbox-only.** No `grid`, no `position: absolute`, no
  `text-overflow: ellipsis` — truncate strings by hand. Every container with
  children needs `display: flex` or `display: none`.
- **Fonts must be `.ttf`/`.otf`/`.woff`, fetched as raw bytes — never the Google
  Fonts CSS endpoint**, which returns `woff2` and makes Satori throw
  `Unsupported OpenType signature wOF2`. The repo already ships
  `client/public/fonts/*.woff2`; convert or add a `.woff` for the renderer.

Serve the card from the **API**, not from nginx, to avoid the SPA catch-all
swallowing the route — a documented failure mode where `/api/og` kept returning
`index.html`.

## What implementation added (2026-10-12)

Three things this ADR did not foresee. All three are now handled; recording them
because each one looks correct in review and fails in production.

1. **The edge has to be taught to route crawlers.** nginx owns the public pages
   (`try_files … /index.html`), so a crawler hitting `client.com/u/alice` never
   reaches the API no matter what the API would answer. nginx now maps
   `User-Agent` → `$aggregator_is_crawler` and proxies `/u/`, `/share/` to the API
   only for crawlers.

   The rejected alternative — proxy unconditionally and let the API redirect
   browsers — **deadlocks**: the redirect target is the same path nginx just
   proxied, so nginx proxies it again. Routing by User-Agent keeps browsers
   entirely in the SPA and never involves the API.

   `nginx -t` runs in the client image build. `proxy_pass` inside `if` is valid
   only because the upstream has no URI part, and only `proxy_pass` is permitted
   there — `proxy_http_version` and friends must sit at `location` level. That is
   exactly the kind of thing that passes review and fails the build.

2. **Satori's layout engine treats percentages as content-box.** The card is
   built with a root `width: 100%` and `padding: 72px`, which a browser renders
   as 1200×630. Yoga adds the padding instead of subtracting it, producing
   1344×774 — the bottom row lands at y=681 and is clipped off the canvas,
   while `resvg` still emits a perfectly valid 1200×630 PNG. Size the root in
   pixels and let a `flexGrow` wrapper carry the padding.

   This is why the OG tests assert *layout*, not just that a PNG comes back: the
   failure mode is a valid image with missing content.

3. **Fonts and WASM need path resolution that survives bundling.** The API
   bundles to `app/dist/index.js`, one directory deeper than the source, and Bun
   hoists `node_modules` differently in the container than in a checkout. Both
   are resolved by walking up from the module rather than by a fixed relative
   path — and there is a test for it, because this is exactly the class of bug
   that only appears after deploy.

## Deployment impact: none

`app/Dockerfile` gains the renderer dependency, one route, and the vendored
fonts. `client/Dockerfile` gains `nginx -t`. `client/nginx.conf` gains the
crawler-routing block described above — that is the one part of this ADR that
touches the edge, and it exists because the edge is what serves the public URLs.
The API is already a long-running Bun server with a health check; it just gains a
route that does some rendering.

## Addendum (2026-10-15): the edge moved into the API

The first real deployment (Render free tier + Neon, `docs/DEPLOY.md`) has no
nginx: a static-only host cannot do User-Agent routing, so the single-service
image (`Dockerfile`) has the API serve the built SPA instead, and the edge
logic from `client/nginx.conf` folds into `app/src/utils/client-spa.ts`:

- Crawlers still get the rendered documents from the same handlers, unchanged.
- Browsers are separated from the app's own `fetch()` calls by
  **navigation markers** (`Sec-Fetch-Mode: navigate`, or an `Accept` header
  advertising `text/html` for older browsers) rather than by URL routing: the
  API and the pages share paths, so a navigation to `/u/alice` gets the SPA
  shell while `fetch("/u/alice")` still gets JSON. The nginx design needed the
  two to live on different layers; in one process the request itself says
  which one it wants.
- The nginx path remains as the self-hosted alternative. Note for anyone
  reviving it: `try_files` in the `^/(u|share)/` location returns `index.html`
  to the SPA's own data fetches on those paths — the edge design assumed the
  SPA never fetched `/u/*` or `/share/*`, which stopped being true when the
  explore directory shipped. The single-process mode does not have this bug:
  fetches carry no navigation markers and always reach the API.

## Consequences

- Link previews work, which is the whole point of phase 3 for a sharing product.
- Crawler detection is a heuristic. It is how the industry does this, and a
  crawler we miss degrades to today's behaviour rather than breaking anything.
- The `<head>` tags live in the API, not in the React tree. That is real
  duplication to keep in mind — but it is a few meta tags, and the client does
  not need them.
- **We are not claiming SSR/SEO benefits.** Crawlers index the crawler HTML,
  which contains no body content. This is deliberate: the product's growth
  channel is link sharing and Explore, not search-engine ranking.

## What would change this

Revisit if the public pages become a genuine SEO surface — i.e. if we decide to
compete for search traffic on published collections rather than for social
shares. At that point body content in the initial HTML matters and option B is
no longer enough. That would be a deliberate decision to be ranked, and it would
justify the Start migration then, with a product reason behind it rather than a
speculative one.