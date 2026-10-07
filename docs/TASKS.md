# Aggregator — Status Tracker

> Last audited: **2026-10-07**
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
| [3](ROADMAP.md#phase-3--public-layer) | Public layer: profiles, readable URLs, server-rendered previews | ❌ not started |
| [4](ROADMAP.md#phase-4--explore-v2) | Explore v2: image mosaics, masonry, ranking, full-text search | ❌ not started |
| [5](ROADMAP.md#phase-5--social-loop) | Social loop: save, fork, follow, view counts | ❌ not started |
| [6](ROADMAP.md#phase-6--monetization) | Monetization: `user.plan`, limits at the API layer | ❌ not started |

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
| ✅ | Forgot/reset password (reset link printed to console — needs a real mail provider) |
| ✅ | `GET /user/me`, `GET /user/stats` (independent counts), `PATCH /user/profile` |
| ❌ | Email verification flow — **needed before public profiles**, or spam accounts fill Explore |
| ❌ | Real email provider (Resend/similar) for password reset |
| ✅ | `username` / `bio` / `avatar` / `plan` on `user` (phase 2). `PATCH /user/profile` validates + stores them (reserved words, case-insensitive-unique index). `plan` is server-managed and **not** client-writable. `/u/:username` itself is phase 3 |

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
| ✅ | `collections.visibility` (`private｜unlisted｜public`) + `published_at` exist (phase 2) — default `private`; **not enforced yet**, that is phase 3 |
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
| ✅ | Drizzle schema with relations + indexes, 9 migrations (now committed to git; `0006`–`0009` are phase 2) |
| ✅ | Isolated test database (`aggregator_test`) via `docker compose` |
| ✅ | `bun test` → **88 passing / 0 failing** across 15 files (integration tests drive `app.handle()` with session cookies; unit tests cover the SSRF guard and the limiter) |
| ✅ | Error plugin, CORS, OpenAPI docs, `/health`, `/api/version` |
| ✅ | Rate limiting: fixed-window, in-process (`app/src/utils/rate-limit.ts`). Global 1000/min per client in `onRequest` (so it caps unauthenticated floods *before* the session lookup), plus per-route 120/min on `POST /bookmarks`, 20/min on bulk, 60/min on `/share/explore`, 120/min on `/share/:code`. Health/version/OpenAPI/auth are exempt. 429 carries `Retry-After` |
| ✅ | Client IP for limits comes from the socket; `x-forwarded-for` / `cf-connecting-ip` are only trusted when `TRUST_PROXY=true` (new env var, documented in `app/.env.example`) so a directly exposed API can't be dodged by spoofing a header |
| 🟡 | Rate-limit counters are per process — a multi-replica deploy needs a shared store (Postgres/Redis) before the limits mean anything |
| ❌ | Request logging / monitoring |
| ✅ | Production deployment: `app/Dockerfile` + `client/Dockerfile` (nginx SPA) + `.dockerignore`, fail-fast env validation, CI green (typecheck/build/tests/images) — #20 |

---

## 2. Frontend (`client/` — React + Vite + TanStack Router/Query + Tailwind + Base UI)

### Auth & Routing

| Status | Task |
|--------|------|
| ✅ | File-based routing, protected layout with auth guard, session-aware `/` redirect |
| ✅ | Login (email/password + Google), sign-up page, forgot/reset password pages |
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
| ✅ | Public `GET /share/explore` directory (active shares only, system collections excluded, `?q=` + pagination, sharer name only — never email) + `/explore` client page |
| ❌ | Public profile `/u/:username` and readable collection URL `/u/:username/:slug` (phase 3) |
| ❌ | **Crawler HTML + OG tags from the API** — the SPA renders client-side, so link previews on Slack/Discord/X are blank. Decided in `docs/decisions/002-public-page-rendering.md` (API renders for crawlers, *not* TanStack Start). Blocks phase 3 |
| ❌ | OG images at 1200×630 via `satori` + `@resvg/resvg-wasm`, served from the API, cached hard |
| ❌ | `GET /share/explore` count ignores sub-collections (`share/index.ts`) |
| ❌ | Image-first presentation: 4-image mosaic covers + masonry on public pages |

### Explore / Social

| Status | Task |
|--------|------|
| ✅ | Basic directory: newest-first, text cards, `?q=` via `ILIKE` |
| ❌ | Categories/tags on the directory; ranking by saves, views, recency (phase 4) |
| ❌ | Postgres full-text search to replace `ILIKE` (phase 4) |
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
| 🟡 | Landing page — shipped: floating navbar (brand / Features·Pricing·Explore / Sign in + Start free), hero, browser-framed share-page preview, `#features` + `#pricing`, close CTA. Still to do: footer, social proof, final copy pass |
| ❌ | Favicon + meta/OG tags (required for phase 3 — see Share/Public) |
| ❌ | User settings page (sidebar "settings" item does nothing) |

### Lint

`bun run lint` passes: **0 errors, 16 warnings**. All 16 are
`react-refresh/only-export-components`, expected for route files that export a
`Route` alongside a component. CI runs lint as a **blocking** step.

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
| 🟡 | Password reset emails only `console.log` the link |
| 🟡 | Metadata scraping is still in-process fire-and-forget. A URL saved with no title keeps its hostname until the background fetch lands (~5s timeout, single attempt); the client polls briefly to pick it up. A durable queue is the follow-up if this becomes load-bearing |
| ✅ | ~~`DELETE /collections/:id` orphaned bookmarks to `collectionId = null` (invisible + un-re-addable)~~ fixed in #22: default delete re-homes to Unsorted, `?deleteBookmarks=true` destroys, parents with children blocked (409), legacy NULLs backfilled + listing is NULL-safe |
| 🟡 | `bunfig.toml` disables **all** dependency lifecycle scripts — a future dependency that genuinely needs a postinstall (sharp, esbuild) will need this revisited |

---

## 6. Frontend backlog

The private dashboard's planned work is complete. What remains is in the phases.

1. ~~Add Bookmark dialog~~ ✅ · ~~Edit Bookmark dialog~~ ✅ · ~~collection & tag dialogs~~ ✅ ·
   ~~sort + filter chips~~ ✅ · ~~breadcrumb + sidebar state~~ ✅ · ~~archive + bulk actions~~ ✅
2. **Small UI debt** — render `ThemeToggle`, favicon/meta/OG, a settings page behind
   the sidebar "settings" item that currently does nothing.
3. **Everything else follows `ROADMAP.md` phases 3–6.** The phase-2 migration
   has landed, so the public layer (phase 3) is unblocked. The data model now
   supports a bookmark in many collections; a multi-select collection UI is a
   separate "organize" feature and can follow the public surfaces.


