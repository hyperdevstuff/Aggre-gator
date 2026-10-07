# ADR-002 — Public pages: crawler-served HTML, not full SSR

> Status: **accepted** · Date: 2026-10-07 · Relates to `ROADMAP.md` Phase 3

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

## Deployment impact: none

`app/Dockerfile` gains the renderer dependency and one route. `client/Dockerfile`
and `client/nginx.conf` are unchanged. The API is already a long-running Bun
server with a health check; it just gains a route that does some rendering.

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