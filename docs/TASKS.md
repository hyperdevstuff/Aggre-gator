# Aggregator — Status Tracker

> Last audited: **2026-10-20** (Wave 0 and Wave 1 merged; `main` is green).
> Migration count, the `be-03` cause list and the phase-map table were corrected
> in the 2026-10-19 audit. Earlier audit: 2026-10-07.
> Plan/phases: [`docs/ROADMAP.md`](ROADMAP.md) · Thesis: [`docs/SPEC.md`](SPEC.md) ·
> Setup/commands: top-level `README.md`.
> Open work items are also tracked as GitHub issues.

## Legend

- ✅ done & verified working
- 🟡 partially done / has known issues
- ❌ not started

## Phase map

Where each section below sits in the roadmap:

| Phase | Scope | State |
|---|---|---|
| [1](ROADMAP.md#phase-1--hardening--done-2026-10-07) | Hardening: SSRF, scrape, stats, rate limits, share payload | ✅ done |
| [2](ROADMAP.md#phase-2--data-model-migration--done-2026-10-07) | Data model: `collection_items`, `archived_at`, visibility, user identity | ✅ done (2026-10-07) |
| [3](ROADMAP.md#phase-3--public-layer--done-2026-10-12) | Public layer: profiles, readable URLs, crawler HTML, OG images | ✅ done (2026-10-12) |
| [4](ROADMAP.md#phase-4--explore-v2--done-2026-10-14) | Explore v2: image mosaics, masonry, ranking, full-text search | ✅ done (2026-10-14); the real ranking signals (saves, views) arrive with phase 5 |
| [5](ROADMAP.md#phase-5--social-loop) | Social loop: save, fork, follow, view counts | ❌ not started |
| [6](ROADMAP.md#phase-6--monetization) | Monetization: `user.plan`, limits at the API layer | ❌ not started |

> **Execution has moved to the issue tracks in [`MARATHON.md`](MARATHON.md)** —
> six backend waves (`be-*`) and two frontend steps (`fe-*`). Wave 0 landed:
> `be-01` (durable jobs), `be-02` (request logging) and `be-03` (enrichment
> fixes) are **done**. Wave 1 (email) — `be-04`…`be-07` — is **merged** (#25);
> `be-08` (domain + DNS) is the only remainder, and it is a human task. The `be-03`
> [corrected diagnosis](MARATHON.md#be-03--corrected-diagnosis-do-not-start-from-the-original-spec)
> is the one to read — the second cause in the original spec was measured wrong.

---

## 1. Backend (`app/` — Bun + Elysia + Drizzle + Postgres + Better Auth)

### Auth & User

| Status | Task |
|--------|------|
| ✅ | Better Auth (email/password + optional Google OAuth) |
| ✅ | Session management (7-day expiry, cookie-based) |
| ✅ | Auth middleware plugin (`betterAuthPlugin`), with the public `/share` prefix exempt |
| ✅ | Auto-create the "Unsorted" system collection on signup (only Unsorted now — "Archived" is a bookmark flag; failure still reports 500, not 401) |
| ✅ | `POST /api/auth/sign-up/email`, sign-in, sign-out |
| ✅ | Forgot/reset password through the provider-agnostic mailer (`be-05`) — the link now goes out by email. With `MAIL_PROVIDER=none` (dev/test) it is still written to stdout, deliberately, so the flow is usable without a provider |
| ✅ | `GET /user/me`, `GET /user/stats` (independent counts), `PATCH /user/profile` |
| ✅ | Email verification flow (`be-06`) — `emailVerification.sendVerificationEmail` sends a verification mail and `user.emailVerified` records it. It gates who may *publish*, not who may exist: unverified accounts sign in, save and organise normally |
| ✅ | Real email provider (**Reloop**) (`be-04`) — `POST https://reloop.sh/api/mail/v1/send` with the `x-api-key` header and `from` as a single string. `MAIL_PROVIDER=none\|reloop`, `RELOOP_API_KEY`, `RELOOP_FROM`. Live delivery still waits on `be-08` (domain + DNS), which affects real mail only, not the code path |
| ✅ | `username` / `bio` / `avatar` / `plan` on `user` (phase 2). `PATCH /user/profile` validates + stores them (reserved words, case-insensitive-unique index). `plan` is server-managed and **not** client-writable |
| ✅ | **better-auth `username()` plugin** (phase 3) — owns normalisation and uniqueness at the auth layer, so no hand-rolled check can be bypassed by calling the auth API directly. `displayUsername: false` (we already have `name`), `validationOrder: "post-normalization"` so "Alice" → `alice` rather than being rejected. No schema change: our nullable column + `user_username_unique` expression index already satisfy it |
| ✅ | Auto-assigned usernames — every signup gets one in a `create.before` hook (so the sign-up response carries it, not `null`), derived from the display name with numbered fallbacks and a random last resort. Migration `0010` backfilled existing accounts and normalised every stored value to lower-case, which the plugin's exact-match availability lookup requires |
| ✅ | `POST /sign-in/username` — sign in with a username; case-insensitive, and a wrong password and an unknown user return the identical message so it cannot enumerate accounts |
| ✅ | `rateLimit` pinned on the auth config. better-auth's limiter is production-only by default and our global Elysia limiter exempts `/api/auth`, so dev/test had **no** cap on credential endpoints. Built-in special rule (3/10s) relaxed to 10/60s for `/sign-in/*` + `/sign-up/email` — strict enough to blunt credential stuffing, loose enough not to block a real person. Disabled under `NODE_ENV=test` |

### Bookmarks API

| Status | Task |
|--------|------|
| ✅ | `POST /bookmarks` — create with metadata scraping + duplicate detection |
| ✅ | `GET /bookmarks` — pagination, filters (collection/favorite/search/tags), sorting |
| ✅ | `GET/PATCH/DELETE /bookmarks/:id`, archive/unarchive |
| ✅ | Bulk: create, update, archive, unarchive, `bulk-delete`, `move` |
| ✅ | SSRF guard on the metadata fetch: http/https only, every resolved address must be public (loopback / RFC1918 / link-local / CGNAT / IPv6 ULA + mapped all refused), redirects followed manually so each hop is re-validated, 512KB body cap, cover URLs sanitized to absolute http(s) — `app/src/utils/url-guard.ts` |
| ✅ | One scrape per save, **after** the response (was two awaited fetches + a 9s in-process retry timer). The placeholder title is the hostname; the enrichment update is guarded on that placeholder so a concurrent user edit wins |
| ✅ | Memberships (phase 2): responses carry `collectionIds: string[]`; create/patch/bulk accept `collectionIds`; `move` takes `collectionIds` (empty → Unsorted). Default filing is Unsorted. `archived` query flag lists archived bookmarks |

### Collections / Tags / Search / Share

| Status | Task |
|--------|------|
| ✅ | Collections CRUD (+ system-collection protection), by-slug, children, bookmarks-by-collection |
| ✅ | `collections.visibility` (`private｜unlisted｜public`) + `published_at` exist (phase 2) — default `private`; **enforced in phase 3**. `POST`/`PATCH /collections` accept `visibility`; publishing requires an owner username, reuses the collection's slug (deriving one from the name when absent), stamps `publishedAt`, and clearing the stamp takes it out of Explore |
| ✅ | Publishing gates (`be-07`) — moving a collection to **any non-`private` visibility** (`unlisted` included, because `/u/:username/:slug` serves it to anyone with the address) and re-activating a share code refuse an unverified account with 403. `private` and every read path stay open. Armed by `ENFORCE_EMAIL_VERIFICATION`, which defaults to *mail being configured* (`MAIL_PROVIDER !== "none"`) so it cannot lock everyone out with no way to receive the link. Deliberately narrower than better-auth's `requireEmailVerification`, which stays tied to a real provider |
| ✅ | `GET /u/explore` — the public directory, `visibility = 'public'` only, newest-published first, with `username` + `slug` for readable links. Explore is **no longer driven by `sharedCollections.isActive`**: a share code means "anyone with the link" (the unlisted tier), and only `visibility` decides what is enumerated |
| ✅ | `GET /u/:username` — public profile: avatar (→ `image` → initials), bio, join date, published collections, and counts that exist today. No email, plan or verification state is ever selected. Distinct-counts bookmarks so one filed in two collections counts once |
| ✅ | `GET /u/:username/:slug` — the readable collection URL. Payload is **identical in shape to `GET /share/:code`**, so the client renders one component for both. Serves `public` and `unlisted`; `private` is a 404, not a 403 (a 403 confirms the collection exists) |
| ✅ | Publishing a parent does **not** publish its children — a served subtree and its bookmark listing include only non-`private` descendants |
| ✅ | Archived bookmarks are excluded from public pages; archiving is filing, not publication |
| ✅ | `collection_items(collection_id, bookmark_id, position, note)` — a bookmark lives in many collections, with per-collection order/note (phase 2). `bookmarks.collectionId` and its FK are **dropped**; reads return `collectionIds` |
| ✅ | `bookmarks.archived_at` — archiving is a flag, not a move, so an archived bookmark keeps its real collection. The `Archived` system collection is gone (phase 2) |
| ✅ | #17: 3-level nesting cap — API rejects a 4th level on create + update (subtree-aware, regression-tested); UI disables "new sub-collection" at max depth and filters the parent picker with inline reasons |
| ✅ | Tags CRUD + `/tags/search` |
| ✅ | `GET /search?q=` unified search |
| ✅ | Share: create/get/revoke + public `GET /share/:code` |
| ✅ | Public share payload is narrower than the owner's row: `note` and `isFavorite` are stripped; subtree resolved with one recursive CTE instead of a query per depth level |
| ✅ | `GET /user/stats` counts bookmarks/collections/tags independently (was a bookmarks×collections×tags cross-join that multiplied the numbers and reported 0 collections for a user with no bookmarks) |
| ✅ | Signup provisioning failure reports 500 with the real cause instead of a misleading 401 |
| ✅ | `DELETE /collections/:id` now checks `isSystem` **before** deleting (was delete-then-check) |

### Infrastructure

| Status | Task |
|--------|------|
| ✅ | Drizzle schema with relations + indexes, **13 migrations** (now committed to git; `0006`–`0009` are phase 2, `0010` is phase 3, `0011` is phase 4b full-text search, `0012` is wave-0 `jobs`) |
| ✅ | Isolated test database (`aggregator_test`) via `docker compose` |
| ✅ | `bun test` → **302 passing / 0 failing** across 30 files (integration tests drive `app.handle()` with session cookies; unit tests cover the SSRF guard, the limiter, crawler detection, crawler-HTML escaping, username derivation, OG rendering, the job queue, metadata scraping, the mailer, password reset and verification) |
| ✅ | Error plugin, CORS, OpenAPI docs, `/health`, `/api/version` |
| ✅ | Rate limiting: fixed-window, in-process (`app/src/utils/rate-limit.ts`). Global 1000/min per client in `onRequest` (so it caps unauthenticated floods *before* the session lookup), plus per-route 120/min on `POST /bookmarks`, 20/min on bulk, 60/min on `/share/explore`, 120/min on `/share/:code`. Health/version/OpenAPI/auth are exempt. 429 carries `Retry-After` |
| ✅ | Client IP for limits comes from the socket; `x-forwarded-for` / `cf-connecting-ip` are only trusted when `TRUST_PROXY=true` (new env var, documented in `app/.env.example`) so a directly exposed API can't be dodged by spoofing a header |
| 🟡 | Rate-limit counters are per process — a multi-replica deploy needs a shared store (Postgres/Redis) before the limits mean anything |
| ✅ | **Durable background jobs** (wave 0, `be-01`) — `jobs` table + worker in `app/src/utils/jobs.ts`, migration `0012_jobs.sql`, no new dependency. Claims with `FOR UPDATE SKIP LOCKED`, exponential backoff stored in `run_at` (not slept on), a `locked_at` lease that reclaims a crashed worker's jobs, and a 24h purge of settled rows. `POST /bookmarks` enrichment is queued instead of `setTimeout(…, 0).unref()`, which was losing the work whenever the Render free tier slept or a deploy landed mid-flight. Graceful `SIGTERM` drain. See [ADR-003](decisions/003-durable-jobs.md) for why this is hand-rolled rather than pg-boss |
| ✅ | **Request logging + request-id** (wave 0, `be-02`) — `app/src/utils/request-log.ts`. One structured JSON line per request to stdout (`ts`, `level`, `method`, `path`, `status`, `durationMs`, `requestId`, `userId`), and every response carries `x-request-id` — the caller's if well-formed, generated otherwise. Never logs cookies, auth headers, bodies, query strings or emails; share codes and reset tokens travel in URLs. `/health` is exempt from *logging* (uptime monitors would bury real traffic) but still returns an id. Fixes the "which request was that" problem that cost an hour on the enrichment bug |
| ❌ | Monitoring/alerting on top of the logs — nothing consumes the JSON yet (no error-rate alert, no dashboard). Log lines are the prerequisite, not the whole feature |
| ✅ | Production deployment: `app/Dockerfile` + `client/Dockerfile` (nginx SPA) + `.dockerignore`, fail-fast env validation, CI green (typecheck/build/tests/images) — #20, with the `images` check repaired in #26. `app/Dockerfile` now also copies `app/assets/fonts` (the OG renderer needs them), and `client/Dockerfile` runs `nginx -t` so a broken crawler-routing config fails the image build rather than the deploy. That check was itself broken: `upstream aggregator_api` names the compose service `api:3001`, which nginx resolves **while parsing**, so every plain `docker build` died with `host not found in upstream` and the `images` job was red on every push (including `main`) from 2026-10-16. It now validates a copy of the config with the address pointed at loopback and restores the shipped file in the same layer |
| ✅ | **Hosted on Render (free) + Neon Postgres (free), 2026-10-15.** Root `Dockerfile` = one image: the API serves the built SPA (`CLIENT_DIST_DIR`), runs migrations on boot, and replaces the nginx tier entirely — see `docs/DEPLOY.md`. Navigation-vs-fetch detection (`app/src/utils/client-spa.ts`) lets the API and the pages share URLs (`Sec-Fetch-Mode: navigate` / `Accept: text/html` → SPA shell, anything else → JSON). The nginx split stays as the self-hosted alternative |
| 🟡 | OG rendering adds ~8 MB to the API bundle (satori + resvg WASM, loaded lazily on first request). Fine at current scale; worth revisiting if the API image size becomes a constraint |

---

## 2. Frontend (`client/` — React + Vite + TanStack Router/Query + Tailwind + Base UI)

### Auth & Routing

| Status | Task |
|--------|------|
| ✅ | File-based routing, protected layout with auth guard, session-aware `/` redirect |
| ✅ | Login (email/password + Google), sign-up page, forgot/reset password pages |
| ✅ | Settings page (`/_protected/settings`) — display name, username, bio, avatar, with a live availability probe and a link to the public profile. Reachable from the sidebar account menu, whose "Settings" item previously did nothing. Form state is seeded by the inner form's initialiser rather than an effect (`react-hooks/set-state-in-effect` rejects the latter) |
| ✅ | `useAuth` context, sign out, `notFoundComponent` wired in `__root.tsx` |
| ✅ | Base UI migration type-safe (all leftover `asChild` → `render`) |
| ✅ | Dev server port pinned & configurable (`VITE_PORT`) |

### Dashboard / Main View

| Status | Task |
|--------|------|
| ✅ | Bookmark grid (1/2/3 cols) with skeletons, cards, search bar, pagination, URL-driven filters |
| ✅ | #10: Add Bookmark dialog (`bookmark-dialog.tsx` create mode). Dashboard "New" button + empty-state `onCreateFirst` wired; invalidates bookmarks/collections/tags; duplicate URL surfaces the API error |
| ✅ | #11: Edit bookmark dialog — pre-filled, opened from card menu via `onEditBookmark`, persisted with `useUpdateBookmark` |
| ✅ | #14: URL-persisted sort control with all 5 options; added missing API `url_asc` support and regression test |
| ✅ | #14: Removable collection/tag/favorite/search filter badges; filter/sort changes reset pagination |
| ✅ | #15: Breadcrumb resolves collection name with loading/unavailable fallbacks |
| ✅ | #16: Archive/unarchive from the UI — card menu archives (bulk endpoint) / restores; delete surfaces the archive-first 409 |
| ✅ | #16: Bulk selection + bulk actions — card checkboxes, sticky action bar (archive/restore, move-to-collection, delete), selection clears on success and filter/page change |
| ✅ | Empty-state "create your first bookmark" wired (`onCreateFirst` → create dialog) |

### Sidebar

| Status | Task |
|--------|------|
| ✅ | System items (Unsorted/Archived/Favorites) with counts, collections tree, tags, delete menus, share dialog |
| ✅ | Sidebar links render as real `<a>` elements again (were invalid `<button><a>` nesting) |
| ✅ | #12/#13: "New collection" / "New tag" / edit menus wired to `CollectionDialog` (name, icon, color, parent picker with 3-level cap) and `TagDialog` (name, color); tag editing also reachable from bookmark tag chips |
| ✅ | #15: Active styling and `aria-current` for collection/tag/system navigation |
| ✅ | #15: All Bookmarks sidebar and breadcrumb links reset dashboard filters |

### Share / Public

| Status | Task |
|--------|------|
| ✅ | Share dialog (create/copy/revoke) + public `/share/:code` page with pagination & nested collections |
| ✅ | Share dialog gained the visibility tier (Private / Unlisted / Public) and a slug field for the readable URL. A share code and `visibility` are independent: the code is the unlisted URL, `visibility` decides whether it is *listed* |
| ✅ | Public `GET /share/explore` directory (sharer name only — never email) + `/explore` client page, now listing `visibility = 'public'` and linking to the readable `/u/:username/:slug` |
| ✅ | Public profile `/u/:username` and readable collection URL `/u/:username/:slug` (phase 3) — see Auth & User / Collections above |
| ✅ | **Crawler HTML + OG tags from the API** (phase 3) — the SPA renders client-side, so link previews were blank. `utils/crawler.ts` detects the unfurlers; `utils/html.ts` renders `og:*`, `twitter:card` and a `<link rel=canonical>`. The branch lives **inside** the existing handlers, after the same queries, so a preview and the page a human sees cannot disagree. Browsers still get exactly the JSON they got before — asserted in `crawler.test.ts` |
| ✅ | Canonical URLs: a crawler arriving via a share code is pointed at `/u/:username/:slug`, so the link a platform stores is the one the owner can change |
| ✅ | **OG images at 1200×630** (phase 3) — `satori` + `@resvg/resvg-wasm`, served from the API (`/og/collection/:id.png`, `/og/profile/:username.png`), `public, max-age=86400, stale-while-revalidate=43200`. Fonts vendored as TrueType in `app/assets/fonts/` because satori cannot read the woff2 files. `X-Robots-Tag: noindex` on the crawler HTML: this is a link-preview surface, not an SEO one |
| ✅ | **nginx crawler routing** — `client/nginx.conf` maps `User-Agent` to `$aggregator_is_crawler` and proxies `/u/`, `/share/` to the API *only* for crawlers; browsers fall through to `try_files` and never touch the API. Unconditional proxying would deadlock, since the redirect target is the same path nginx just proxied. `nginx -t` runs in the image build, because that `if`/`proxy_pass` combination is version-sensitive |
| ✅ | Favicon (`favicon.svg`), theme-color, description and title in `index.html` |
| ✅ | Sub-collection count fixed (phase 4a) — `getCollectionSubtreeMeta()` counts a collection's whole subtree (non-private descendants, non-archived, each bookmark once) for Explore, the public profile, the collection pages' nested pills and the OG card, so a card and the page it links to can no longer disagree |
| ✅ | Image-first presentation (phase 4a): `CollectionMosaic` renders up to 4 covers from a collection's subtree; CSS-column masonry on Explore, the public profile and the public collection page |

### Explore / Social

| Status | Task |
|--------|------|
| ✅ | Basic directory: newest-first (or `sort=top` by subtree count), mosaic cards, full-text `?q=`, tag facets + `?tag=` filter (phase 4) |
| ✅ | Postgres full-text search replaces `ILIKE` on the public directory and `/search` (phase 4b) — word + prefix matching; mid-word substrings no longer match, which is a deliberate behavior change |
| 🟡 | Ranking: `new`/`top` today; the real signals (saves, views) are phase-5 tables |
| ❌ | Save a single link / fork a shared collection; follow a curator; view counts (phase 5) |
| ❌ | `links` table (shared preview + save count) + `normalizeUrl()` — deferred to phase 5, see `docs/decisions/001-links-table.md`. Keep the existing per-user `bookmarks_user_url_unique` as-is until then |
| ❌ | Moderation + reporting — required once content is public |

### UI / Design

| Status | Task |
|--------|------|
| ✅ | Shadcn (Base UI port) components, dark mode provider, toasts, responsive sidebar; inset variant enabled, single main landmark and valid mobile trigger; account menu lives in `SidebarFooter` (bottom), dropdown opens upward; logo + wordmark header; all dropdowns use styled `Select`, no native selects |
| ✅ | Brand mark standardised on `components/ui/logo.tsx` + "Aggregator" across `login`, `share.$code` and the landing navbar |
| ✅ | "Wet slate" design tokens landed in `client/src/index.css` (`[data-wet-slate]`, `--hairline-*` palette, `meta-sm`) — see `docs/DESIGN.md` |
| ✅ | Hairline figures run in-app: `components/hairline/figure.tsx` + `lib/hairline/host.ts` load `client/public/<name>.js`, `landing-prototype` route switches between them |
| 🟡 | `ThemeToggle` exists but is not rendered anywhere |
| 🟡 | Landing page — shipped: floating navbar (brand / Features·Pricing·Explore / Sign in + Start free), hero, browser-framed share-page preview, `#features` + `#pricing`, close CTA. Still to do: social proof, final copy pass |
| ✅ | Favicon + meta/OG tags (phase 3) — `favicon.svg` built from the same three paths as the React `Logo`, plus title/description/theme-color in `index.html`. Public-page OG tags are served by the API, not the SPA (see Share/Public) |
| ✅ | User settings page (sidebar "settings" item now routes to `/settings`) |
| ✅ | `Avatar` gained an `xl` size for the public profile header, rather than overriding typography on `AvatarFallback` (the shadcn lint forbids that) |

### Lint

`bun run lint` passes: **0 errors, 20 warnings**. All 20 are
`react-refresh/only-export-components`, expected for route files that export a
`Route` alongside a component (four more route files arrived in phase 3). CI runs
lint as a **blocking** step.

### API Client & Hooks

| Status | Task |
|--------|------|
| ✅ | Typed API client, React Query hooks, mutations with invalidation |
| ✅ | `userApi.update` → `PATCH /user/profile` (route mismatch fixed) |
| ✅ | #13: `tagsApi.update` → `PATCH /tags/:id` with `useUpdateTag` mutation |

---

## Phase 2 shipped — data model (2026-10-07)

`bookmarks.collectionId` is gone; memberships live in `collection_items`.
Four migrations, applied in this order:

| Migration | What |
|---|---|
| `0006_lucky_red_ghost` | `collection_items` + `bookmarks.archived_at` + `collections.visibility`/`published_at` + `user.username`/`bio`/`avatar`/`plan` |
| `0007_collection-items-backfill` | one membership per bookmark backfilled from the old FK (position = creation order) |
| `0008_archive-via-archived-at` | set `archived_at` for bookmarks in the Archived collection, re-home to Unsorted, delete the Archived collection |
| `0009_goofy_the_hood` | drop `bookmarks.collection_id`, its FK and index |

- Reads return `collectionIds: string[]`; create/patch accept `collectionIds`,
  and `POST /bookmarks/move` takes `collectionIds` (empty → Unsorted). The
  `?collectionId=` list filter stays — it means "filed in this one collection".
- `POST /:id/archive` / `unarchive` set/clear `archivedAt`; `DELETE /:id` and
  `bulk-delete` require it. `GET /bookmarks?archived=true` is the archived view;
  `includeArchived=true` still returns everything.
- Frontend: `Bookmark.collectionIds`, `Bookmark.archivedAt`; the sidebar
  "Archived" item is a static `?archived=true` link, not a collection.
- New integration tests: `collection-items`, `archived`, `profile` — **88
  passing**. Migrate the test DB (`bun run db:migrate:test`) before running them.
- **Not** done here: enforcing `visibility` on public surfaces (phase 3), and a
  multi-select collection UI (the storage supports many; the UI still files one).

## Phase 3 shipped — the public layer (2026-10-12)

The social half's entry point. `/u/:username` and `/u/:username/:slug` exist,
`visibility` is enforced, and a pasted link previews.

| Piece | Where |
|---|---|
| `username()` plugin + auto-assignment | `app/src/utils/auth.ts`, `app/src/utils/username.ts`, `app/src/utils/user-identity.ts` |
| Backfill + Explore index | `app/drizzle/0010_public-identity-backfill.sql` |
| Public profile + readable collection + directory | `app/src/public/index.ts` |
| Publish rules (slug, `publishedAt`, preconditions) | `app/src/collections/index.ts` |
| Crawler detection + document | `app/src/utils/crawler.ts`, `app/src/utils/html.ts` |
| OG card rendering | `app/src/og/render.ts`, `app/src/og/index.ts`, `app/assets/fonts/` |
| Edge routing | `client/nginx.conf` |
| Shared public-collection view | `client/src/components/public/public-collection-view.tsx` |

Decisions worth remembering:

- **better-auth's plugin replaced our hand-rolled username rules.** Our column
  was already nullable and uniquely indexed on `lower(username)`, so no schema
  change was needed — only config. The manual uniqueness query in
  `PATCH /user/profile` is gone; the plugin is the authority.
- **`validationOrder: "post-normalization"` is load-bearing.** With the default
  `pre` order the validator sees the raw input and rejects "Alice" before it can
  be normalized.
- **The plugin's availability lookup is exact-match** (`WHERE username = ?`),
  which is why migration `0010` normalises every stored value to lower-case.
- **Explore is keyed on `visibility`, not on `isActive`.** A share code means
  "anyone with the link"; only `visibility = 'public'` is enumerable. This is
  what makes "unlisted" a tier that means something.
- **One renderer for two URLs.** `/u/:username/:slug` returns exactly the
  `/share/:code` payload shape so `PublicCollectionView` serves both; two copies
  would drift.
- **Crawler HTML branches inside the existing handlers**, after the same
  queries, rather than in a parallel route — so a preview can never disagree
  with the page.
- **nginx routes by User-Agent.** Unconditional proxying deadlocks, because the
  API's redirect target is the same path nginx just proxied.

## Phase 4a shipped — Explore visuals + count (2026-10-14)

The public directory now looks like a browse surface, and its counts agree with
the pages they link to.

| Piece | Where |
|---|---|
| Subtree count + cover query | `getCollectionSubtreeMeta()` — `app/src/utils/collections.ts` |
| Wired into the public surfaces | `app/src/public/index.ts` (Explore, profile, nested pills), `app/src/share/index.ts`, `app/src/og/index.ts` |
| Mosaic component | `client/src/components/public/collection-mosaic.tsx` |
| Masonry | CSS columns on `client/src/routes/explore.tsx`, `client/src/routes/u.$username.tsx`, `client/src/components/public/public-collection-view.tsx` |

Decisions worth remembering:

- **No migration.** Covers and subtree counts are computed per request with one
  recursive CTE for the whole page (≤24 roots), not per card.
- **Count semantics match the public page**: subtree of *non-private*
  descendants, archived excluded, each bookmark counted once. The share-code
  page lists every descendant, so its nested pills pass
  `includePrivateDescendants: true` to follow its own listing.
- **The owner's dashboard counts are unchanged** — `collectionBookmarkCount()`
  (direct members) is still used there.
- **Masonry uses CSS columns**, so visual order is column-major; DOM order is
  unchanged. Acceptable for a directory.
- **Also fixed a phase-3 SPA routing bug:** `u.$username.tsx` (the profile) had a
  child route but rendered no `<Outlet />`, so every `/u/:username/:slug` URL
  mounted the *profile* and the readable collection page never rendered (the
  API tests passed; nothing exercised the SPA route). It is now a layout with
  `<Outlet/>`, the profile moved to `u.$username.index.tsx`, and the collection
  is a sibling — verified in a real browser.
- **Still open in phase 4:** tag facets, full-text search, and ranking (its
  saves/views signals are phase-5 tables, so ranking stays recency + count).

## Phase 4b shipped — facets, full-text search, ranking (2026-10-14)

Explore is now a directory worth browsing: filter by tag, search by word or
prefix, sort by popularity.

| Piece | Where |
|---|---|
| FTS columns + GIN indexes | `app/drizzle/0011_explore-full-text-search.sql` (no `schema.ts` change, consistent with hand-written migrations) |
| `ftsCondition()` | `app/src/utils/full-text-search.ts` |
| Facets + tag filter + response assembly | `app/src/utils/explore.ts` (`tagInSubtree`, `getPublicTagFacets`, `buildExploreResponse`) |
| Wired into the directory | `app/src/public/index.ts` (`/u/explore`), `app/src/share/index.ts` (legacy parity), `app/src/search/index.ts` |
| Chips + Newest/Top toggle | `client/src/routes/explore.tsx` |

Decisions worth remembering:

- **Search semantics changed on purpose.** `ILIKE '%q%'` is gone from the
  public directory and `/search`: matching is now whole words plus a word
  prefix (`zepp` → `Zeppelin`), via `websearch_to_tsquery` + a sanitized
  `:*` arm. `q=eppeli` no longer matches `Zeppelin`. The dashboard bookmark
  filter keeps ILIKE — out of scope.
- **Facets come from the candidate set, not the filtered one.** The chips are
  computed *without* the active tag so pressing one does not reshuffle them.
- **Tag membership is subtree-aware**, exactly like the counts: a collection
  "has" a tag when a non-archived bookmark in its non-private subtree carries
  it.
- **`sort=top` sorts in the app**, not with a LATERAL per row: fetch all
  candidates, enrich through the same batched `getCollectionSubtreeMeta` the
  cards display, sort, slice. The ranking number and the displayed number are
  the same value by construction.
- **Validation errors are 400 here, not 422** — the global error plugin maps
  `VALIDATION` deliberately (`app/src/error.ts`). An unknown `sort` returns 400.
- **`?tag=` (empty) is ignored, not a 422** — the schema has no `minLength`,
  per Elysia/TypeBox strictness confirmed against the docs.

## 3. Fixed on 2026-10-07 (hardening pass)

| Fix | Where |
|-----|-------|
| **SSRF** — the API fetched any pasted URL, so `http://127.0.0.1:3001` and the cloud metadata address were reachable. Now http/https only, every resolved address must be public, redirects re-validated per hop, 512KB body cap, cover URLs sanitized | `app/src/utils/url-guard.ts`, `app/src/utils/metadata.ts` |
| **Double scrape** — `POST /bookmarks` fetched the page twice and awaited both, discarding the first image, with a 9s in-process retry timer. Now one fetch after the response; the update is guarded on the placeholder title so a concurrent user edit wins | `app/src/bookmarks/index.ts` |
| **`/user/stats`** counted a bookmarks×collections×tags cross-product and reported 0 collections for a user with no bookmarks | `app/src/user/index.ts` |
| **No rate limiting anywhere**, including the outbound-fetch path and the public endpoints | `app/src/utils/rate-limit.ts`, `app/src/index.ts` |
| **Public share page leaked `isFavorite`** (and served `note`), and walked the tree with one query per depth level | `app/src/share/index.ts` |
| **Signup hook reported a provisioning failure as 401**, telling users their credentials were wrong | `app/src/utils/auth.ts` |
| Client type `PublicBookmark` no longer claims fields the API strips | `client/src/types/index.ts` |

## 4. Fixed on 2026-09-15 (refresh session)

| Fix | Where |
|-----|-------|
| TS 6/7 tsconfig migration (`baseUrl` removed, `moduleResolution: bundler`) | `client/tsconfig*.json`, `app/tsconfig.json` |
| 11 leftover Radix `asChild` props → Base UI `render` prop | `bookmark-card.tsx`, `sidebar/*` |
| Invalid `<button><a>` nesting → `render={<Link/>}` | sidebar collections/tags/system items |
| Leftover Radix CSS var on the sidebar footer dropdown | `sidebar/footer.tsx` |
| Unsorted/Archived icons compared against a lowercase slug (backend uses "Unsorted") | `sidebar/system-items.tsx` |
| Unused `React` import | `ui/scroll-area.tsx` |
| `DELETE /collections/:id` deleted system collections before erroring | `app/src/collections/index.ts` |
| Public share routes returned **401 to anonymous visitors** — `betterAuthPlugin` is `.as("global")`, so its session `derive` ran on every route including `GET /share/:code`. Every protected router already `.use`s the plugin explicitly, so the fix exempts the public `/share` prefix inside the derive. The public share page was non-functional for logged-out readers until this | `app/src/utils/auth.ts` |
| `userApi.update` hit `/user/me` instead of `/user/profile` (404 on save) | `client/src/lib/api-client.ts` |
| `re2` native build broke `bun install` on Windows → `app/bunfig.toml` sets `install.ignoreScripts = true` (re2 is unused at runtime) | `app/bunfig.toml` |
| Tests: no longer bind port 3000 (`NODE_ENV=test` guard) + authenticate with session cookies instead of a bearer token the API never supported | `app/src/index.ts`, `app/src/test/integration/*` |
| Test DB isolated from dev data (`aggregator_test`) + `db:migrate:test` script | `docker-compose.yml`, `app/drizzle.test.config.ts` |
| Vite config reads `.env.local` via `loadEnv` (the `/api` proxy never resolved env before) + pinned port | `client/vite.config.ts` |
| Drizzle migrations committed to git (were gitignored → fresh clones couldn't migrate) | `app/.gitignore` |
| Dependencies refreshed in both packages (see README) | `app/package.json`, `client/package.json` |

---

## 5. Known Bugs (open)

| Severity | Bug |
|----------|-----|
| ✅ | ~~Password reset emails only `console.log` the link~~ fixed in #25 (`be-04`/`be-05`): reset links go through the mailer — a no-op that prints in dev/test, Reloop in production. Live delivery still waits on `be-08` (domain + DNS) |
| ✅ | ~~No email verification~~ fixed in #25 (`be-06`/`be-07`): a verification mail is sent, and an unverified account cannot publish (`public` **or** `unlisted`) or re-activate a share code. It still does not gate sign-in or saving — that is deliberate and is the difference between a control and a support burden |
| 🟡 | Crawler HTML is keyed off a User-Agent allowlist. A preview service we do not recognise degrades to an empty card rather than breaking anything — the documented failure mode in ADR-002 |
| 🟡 | OG cards have no cache-busting revision, so renaming a collection leaves a stale card in a platform's cache until `stale-while-revalidate` (12h) elapses. The URL shape takes a revision suffix if that ever matters |
| ✅ | Metadata enrichment retries the failures worth retrying and no longer loses covers. `scrapeMetadata` throws `TransientScrapeError` for timeouts, dropped connections, 429 and 5xx so the queue backs off and retries; 404s, refused URLs and redirect loops still fall back to the hostname. Script/style bodies are dropped before the 512 KB cap is applied, so a page whose inline bundle pushed `<meta og:image>` past the cap no longer loses its cover while keeping its title. Enrichment now queues whenever any field is missing, not only when the title is — a hand-titled bookmark can finally get a cover — and the handler writes back only the fields the caller left empty, each behind its own guard. The enqueue is now **awaited**: it was fire-and-forget, so `POST /bookmarks` could return before the job row was committed and the worker could run before it existed — the intermittent `processed: 0` that showed up as a flaky CI test on unrelated branches. The enrichment tests also clear the `jobs` table between cases. See [MARATHON.md](MARATHON.md#be-03--corrected-diagnosis-do-not-start-from-the-original-spec) |
| ✅ | ~~`DELETE /collections/:id` orphaned bookmarks to `collectionId = null` (invisible + un-re-addable)~~ fixed in #22: default delete re-homes to Unsorted, `?deleteBookmarks=true` destroys, parents with children blocked (409), legacy NULLs backfilled + listing is NULL-safe |
| 🟡 | `bunfig.toml` disables **all** dependency lifecycle scripts — a future dependency that genuinely needs a postinstall (sharp, esbuild) will need this revisited |

---

## 6. Frontend backlog

The private dashboard's planned work is complete. What remains is in the phases.

1. ~~Add Bookmark dialog~~ ✅ · ~~Edit Bookmark dialog~~ ✅ · ~~collection & tag dialogs~~ ✅ ·
   ~~sort + filter chips~~ ✅ · ~~breadcrumb + sidebar state~~ ✅ · ~~archive + bulk actions~~ ✅
2. **Small UI debt** — render `ThemeToggle`; landing-page social proof and a final
   copy pass. Favicon/meta and the settings page landed in phase 3.
3. **Everything else follows `ROADMAP.md` phases 4–6.** Phases 2 and 3 are done, so
   Explore v2 and the social loop are unblocked. The data model supports a
   bookmark in many collections; a multi-select collection UI is a separate
   "organize" feature and can follow.


