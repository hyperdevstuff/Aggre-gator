# Aggregator — Roadmap

> Written 2026-10-07 from a full audit of the working tree (backend, frontend,
> data model, deployment). This is the plan we are following.
>
> Product thesis: [`docs/SPEC.md`](SPEC.md) · Status: [`docs/TASKS.md`](TASKS.md) ·
> Design system: [`docs/DESIGN.md`](DESIGN.md)

**The one-line shape of it:** the private bookmark manager is essentially
finished, and it is good work. What is missing is the *social* half — public
profiles, a real Explore, and the ability to save what other people published.
That half cannot be built on the current data model, so phases 1–3 are the
prerequisites, not optional prep.

---

## 1. Where we actually are

Roughly **60–70% of the backend groundwork** for "save links → organize into
collections → share" is built and verified by integration tests.

**Solid, keep building on it:**

| Area | State |
|---|---|
| Auth | Email/password + optional Google OAuth, cookie sessions, password reset (link still printed to console) |
| Bookmarks | CRUD, auto metadata, duplicate detection, filters, sorting, pagination, bulk move/archive/delete |
| Collections | Nested to 3 levels, one shared depth rule for API + UI (`shared/collection-tree.ts`), per-owner write locks on tree mutations, system-collection protection, delete re-homes to Unsorted |
| Tags / Search | Full CRUD, unified `/search` |
| Sharing | Public `/share/:code` with nested collections + pagination, `/share/explore` directory |
| Infra | Integration tests against a separate DB, CI, Dockerfiles, fail-fast env validation |

The private product is done. The public product does not exist yet.

---

## 2. The gap

| Capability | Status | What stands in the way |
|---|---|---|
| Public profile `/u/:username` | ❌ | No `username` on `user` (only `name`), no endpoint, no page |
| Public / unlisted / private | ❌ | These are one thing today: any active share link silently appears in Explore |
| Readable public URLs | ❌ | Links are random codes. `collections.slug` already exists and is unused for this |
| Explore worth browsing | 🟡 | Text cards, newest-first, no images, no ranking. Its bookmark count ignores sub-collections (`app/src/share/index.ts:88`) |
| Save someone else's link / collection | ❌ | Not built. This is the Pinterest loop — and it needs phase 2 first |
| Follow / like / view counts | ❌ | No tables |
| Image-first masonry layout | ❌ | Cover images are fetched and stored; the public pages just don't show them well |
| Manual ordering in a collection | ❌ | The spec promises "in this order"; there is no `position` column |
| Plans / billing | ❌ | `user.plan` does not exist |
| Email verification + mail provider | ❌ | Required *before* public profiles, or spam accounts fill Explore |
| Moderation / reporting | ❌ | Required once content is public |
| Link previews, SEO, OG tags | ❌ | Public pages are client-rendered only, so Twitter/Slack previews are blank. This matters more than usual for a sharing product |

---

## 3. Data model changes (phase 2 — do these first)

These get harder to change every week we wait. Nothing in phases 3–5 is worth
starting before they land.

**3.1 — A bookmark belongs to exactly one collection.**
`bookmarks.collectionId` is a single FK, so one link can only ever live in one
collection, and "save someone else's link" has nowhere to point. **Decision:
option (a)** — add `collection_items(collection_id, bookmark_id, position, note)`.
One bookmark, many collections, per-collection ordering and per-collection note.
Reconsidered option (b), "save copies the bookmark row", is cheaper but makes
"saved 1.2k times" impossible and lets the copy's metadata rot.

A separate `links` table — so everyone saving the same URL shares one fetched
preview and one save count — is **deferred to phase 5**, where
save-someone-else's-link is actually built. Rationale, and the URL-normalization
rules that must go with it: [`decisions/001-links-table.md`](decisions/001-links-table.md).

**3.2 — "Archived" should not be a collection.**
Archiving currently *moves* the bookmark out of its real collection, so it
loses where it belonged, and archiving mutates the contents of a collection
that might be published. Replace with `bookmarks.archived_at`.

**3.3 — Visibility belongs on the collection.**
Add `collections.visibility` (`private | unlisted | public`) and `published_at`.
Keep `shared_collections` for what the spec already reserves it for — password,
expiry, view count, plan. Random codes then become the *unlisted* mechanism
rather than the only mechanism.

**3.4 — The user needs an identity.**
`username` (unique, reserved words, case-insensitive), `bio`, `avatar`, `plan`.

---

## 4. Phases

### Before you start

This file is the *what and why*. Two things live elsewhere and you need both:

- **[`AGENTS.md`](../AGENTS.md)** — commands, ports, dev environment, frontend
  conventions, and the API gotchas that have bitten before (the `tags` shape
  mismatch, `bookmarkCount` not `count`, the archive-before-delete rule, the
  SSRF guard and rate-limit rules). Read it first.
- **[`docs/DESIGN.md`](DESIGN.md)** — before any UI work. The palette, type,
  motion and the hairline figures, including rules the linter enforces.

Verify the tree before you trust any status above:
`bun install && docker compose up -d && bun run db:migrate && bun run typecheck && bun run lint && bun run test`

### Phase 1 — Hardening ✅ done (2026-10-07)

Everything below shipped, with tests:

- **SSRF guard** (`app/src/utils/url-guard.ts`) — the server fetches any URL a
  user pastes, so `http://127.0.0.1:3001` and `http://169.254.169.254/` were
  reachable. Now: http/https only, every resolved address must be public
  (loopback, RFC1918, link-local, CGNAT, IPv6 ULA/mapped all refused),
  redirects followed by hand so each hop is re-validated, 512KB body cap, cover
  URLs sanitized to absolute http(s).
- **One scrape per save, after the response** — was two awaited fetches plus a
  9s in-process retry timer, with the first fetch's image thrown away.
- **`/user/stats`** — the bookmarks×collections×tags cross-join multiplied the
  counts and reported 0 collections for a user with no bookmarks.
- **Rate limiting** (`app/src/utils/rate-limit.ts`) — global 1000/min per client
  in `onRequest`, so unauthenticated floods are capped *before* the session
  lookup, plus per-route caps on bookmark create, bulk create, and both public
  share routes.
- **Public share payload** no longer exposes `note` or `isFavorite`; the
  subtree is one recursive CTE instead of a query per depth level.
- **Signup hook** reports 500 with the real cause instead of a 401 that said the
  credentials were wrong.
- **Lint clean and blocking** — the 3 errors in `client/src/components/hairline/figure.tsx`
  (refs written during render, an inline `aspectRatio`) are fixed, and CI no longer
  runs lint with `continue-on-error`. 16 `react-refresh` warnings remain and are expected.

Still open: a real mail provider + email verification, and request logging.

### Phase 2 — Data model migration ✅ done (2026-10-07)

Landed. `bookmarks.collectionId` is gone; a bookmark's memberships live in
`collection_items(collection_id, bookmark_id, position, note)`. It shipped as
four migrations: `0006` (schema: table + `archived_at` + `visibility`/
`published_at` + user identity), `0007` (backfill memberships from the old FK),
`0008` (`archived_at` from the Archived collection, then drop it), `0009` (drop
`collectionId` and its FK).

The PR order was **(a) schema+backfill → (b) dual-read → (d) archived_at →
(c) drop**, not the (a)(b)(c)(d) below. Reason: dropping `collectionId` before
archiving moved off the collection would have forced a throwaway
"archive-via-membership" implementation that (d) then deletes. Doing (d) first
made the drop a pure storage change, with no dead code. Dual-write was
collapsed into the drop because there is no live deployment with user data to
protect (the plan flagged this as acceptable); dual-read did ship and is tested.

**Deliberately not done in phase 2:** `visibility`/`published_at` are added but
not enforced — nothing sets `public` yet, so gating Explore would empty it.
Enforcement is phase 3. The interaction stays single-collection (a bookmark is
filed into one collection at a time); the many-to-many *storage* is what phase 5
needs, not a multi-select UI.

**Settled:** 3.1(a) — `collection_items`, not copy-on-save. The `position` column
and any "saved N times" count ride on it, and (b) makes both impossible.

**Blast radius — measure this before you start.** `collectionId` is referenced
**64 times across 16 files**. It is not a contained schema change; it is the
widest-reaching edit in the roadmap.

| Area | Files | `collectionId` refs |
|---|---|---|
| Backend bookmarks | `bookmarks/index.ts`, `$id.ts`, `bulk.ts` | 38 |
| Backend collections | `collections/index.ts`, `utils/collections.ts` | 15 |
| Backend share | `share/index.ts` (subtree CTE + the Explore count) | 11 |
| Frontend | 10 files: dashboard, bookmark grid/card/dialog, sidebar, bulk bar, hooks, api-client, types | 50 |

The archive migration is similarly spread. `eq(collections.slug, "archived")` is
looked up inline in **five** backend places (`bookmarks/index.ts`, `$id.ts`,
`bulk.ts` ×2) plus `client/src/components/bookmark-card.tsx`, which branches on
an `isArchived` prop. All of it collapses into `archived_at IS NULL` once 3.2
lands.

Sequence it so the app is never broken mid-migration — `collection_items` needs a
one-time move of every bookmark's `collectionId` into a first row so nothing is
lost, then a **dual-read window** before the old column is dropped:

1. Add `collection_items` + `bookmarks.archived_at` + `collections.visibility`
   + `collections.published_at` + the `user` columns. **Nothing reads them yet.**
2. Backfill `collection_items` from `bookmarks.collectionId`. Add the unique
   `(collection_id, bookmark_id)` index and a `position` defaulting to insert order.
3. Dual-read: every query falls back to `collectionId` when a bookmark has no
   `collection_items` row. Ship and watch for errors.
4. Dual-write, then verify counts match between the two paths.
5. Drop `bookmarks.collectionId`, remove the fallback, drop the "Archived"
   system collection in favour of `archived_at`.

The "Archived" collection migration is the one users will notice: their archived
bookmarks must keep their real collection, which is the whole point of 3.2.

### Phase 3 — Public layer

- `/u/:username` — profile: avatar, bio, public collections, follower counts.
- `/u/:username/:slug` — a public collection at a readable URL. The random code
  stays for unlisted links.
- **Crawler-served HTML with OG tags, generated by the API — not TanStack
  Start.** Decided in [`decisions/002-public-page-rendering.md`](decisions/002-public-page-rendering.md).
  Short version: Start is still RC, adopting it means changing the deployment
  model away from static files + nginx, and it solves a speed problem we do not
  have. Detect crawlers by `User-Agent` on the public routes and answer them with
  a small `text/html` document; everyone else gets the SPA exactly as today.
  **This is the one non-negotiable item in the phase** — a sharing product whose
  links preview as nothing when pasted is not shareable.
- **OG images via `satori` + `@resvg/resvg-wasm`** at 1200×630, served from the
  API (not nginx — the SPA catch-all will swallow the route), cached hard. Note
  the two traps in the ADR: Satori is flexbox-only, and fonts must be raw
  `.ttf`/`.otf`/`.woff` bytes, never the Google Fonts CSS endpoint.
- Favicon and canonical/meta tags.

### Phase 4 — Explore v2

- 4-image mosaic covers built from bookmark images, masonry layout.
- Tags and categories; ranking by saves, views and recency.
- Postgres full-text search to replace `ILIKE`.
- Fix the count to include sub-collections.

### Phase 5 — Social loop

- **The `links` table lands here** — see
  [`decisions/001-links-table.md`](decisions/001-links-table.md). `normalizeUrl()`
  first as a pure unit-tested function, used for soft near-duplicate detection;
  only promoted to a unique key when save-someone-else's-link ships.
- Save a single link into your own collection; fork/copy a shared collection.
- Follow curators. Remix counts as social proof.
- View counts per share — this is also the analytics paywall's data source.

### Phase 6 — Monetization

- Add `user.plan`; enforce limits **at the API layer**, never only in the UI.
- Then the ladder in `SPEC.md`: limits → analytics → passwords/expiry → custom
  slugs → multi-collection pages → branding.

---

## 5. Working agreement

**Definition of done for any phase:** `bun run typecheck`, `bun run lint` and
`bun run test` all pass, `docs/TASKS.md` is updated to match reality, and any new
API surface has an integration test. Lint is blocking in CI, so it is not
optional.

**Splitting the work.** Phases 2–6 are large. Each is a sequence of PRs that
should each leave the app working, not one branch per phase. Good splits:

- Phase 2: (a) add columns + backfill, (b) dual-read, (c) dual-write + drop
  `collectionId`, (d) `archived_at` and remove the Archived collection,
  (e) `username` + profile fields.
- Phase 3: (a) `username` + `/u/:username`, (b) slug URLs,
  (c) server-rendered previews, (d) meta/OG + favicon.

**Where to record decisions.** If you reverse something in section 3 or reorder
the phases, edit this file — it is the thing you were handed, and a stale plan
is worse than none. `docs/TASKS.md` tracks per-area status; this file tracks
direction.

**Load-bearing decisions have their own ADR** in `docs/decisions/`. Read the
relevant one *before* implementing the phase it governs — they record the options
rejected and why, which is the part you would otherwise re-litigate:

| ADR | Decides | Affects |
|---|---|---|
| [001](decisions/001-links-table.md) | The `links` table is deferred to phase 5, not phase 2 | Phase 5, and what `normalizeUrl()` must do |
| [002](decisions/002-public-page-rendering.md) | Crawler-served HTML from the API, not TanStack Start | Phase 3, and `app/Dockerfile` |

---

## 6. Keep going / stop

**Keep.** The stack (Bun + Elysia + Drizzle + Postgres + Better Auth). The
folder-per-resource backend layout. The shared tree logic. Integration tests
driving `app.handle()` with real session cookies. TanStack Router/Query on Base
UI. CI and Docker.

**Stop or hold.**

- Further polish of the *private* dashboard — sidebar details, animations. It is
  good enough; the remaining value is all in the public half.
- Paid sharing features (passwords, branding, multi-collection pages) until
  public profiles and Explore exist. Nobody pays for share analytics with no
  traffic behind it.
- Team workspaces. That is a different product; park it.
- Treating the random code as *the* share link. Codes are for unlisted links.

---

## 7. Why this order

Public browsing is the free growth channel that feeds the paid tiers in
`SPEC.md`. But it cannot be built on a model where a bookmark lives in exactly
one collection and every share link is automatically public — so the model
comes first, then the public surfaces, then ranking, then the social loop, then
money.
