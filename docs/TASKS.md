# Aggre-gator — Status Tracker

> Last audited: **2026-09-18** (working-tree verification + sidebar account move + #16/#17)
> Setup/commands: see the top-level `README.md`. Product direction: `docs/SPEC.md`.
> Open work items are also tracked as GitHub issues.

## Legend

- ✅ done & verified working
- 🟡 partially done / has known issues
- ❌ not started

---

## 1. Backend (`app/` — Bun + Elysia + Drizzle + Postgres + Better Auth)

### Auth & User

| Status | Task |
|--------|------|
| ✅ | Better Auth (email/password + optional Google OAuth) |
| ✅ | Session management (7-day expiry, cookie-based) |
| ✅ | Auth middleware plugin (`betterAuthPlugin`) |
| ✅ | Auto-create "Unsorted" + "Archived" system collections on signup |
| ✅ | `POST /api/auth/sign-up/email`, sign-in, sign-out |
| ✅ | Forgot/reset password (reset link printed to console — needs a real mail provider) |
| ✅ | `GET /user/me`, `GET /user/stats`, `PATCH /user/profile` |
| ❌ | Email verification flow |
| ❌ | Real email provider (Resend/similar) for password reset |

### Bookmarks API

| Status | Task |
|--------|------|
| ✅ | `POST /bookmarks` — create with metadata scraping + duplicate detection |
| ✅ | `GET /bookmarks` — pagination, filters (collection/favorite/search/tags), sorting |
| ✅ | `GET/PATCH/DELETE /bookmarks/:id`, archive/unarchive |
| ✅ | Bulk: create, update, archive, unarchive, `bulk-delete`, `move` |

### Collections / Tags / Search / Share

| Status | Task |
|--------|------|
| ✅ | Collections CRUD (+ system-collection protection), by-slug, children, bookmarks-by-collection |
| ✅ | #17: 3-level nesting cap — API rejects a 4th level on create + update (subtree-aware, regression-tested); UI disables "new sub-collection" at max depth and filters the parent picker with inline reasons |
| ✅ | Tags CRUD + `/tags/search` |
| ✅ | `GET /search?q=` unified search |
| ✅ | Share: create/get/revoke + public `GET /share/:code` |
| ✅ | `DELETE /collections/:id` now checks `isSystem` **before** deleting (was delete-then-check) |

### Infrastructure

| Status | Task |
|--------|------|
| ✅ | Drizzle schema with relations + indexes, 4 migrations (now committed to git) |
| ✅ | Isolated test database (`aggregator_test`) via `docker compose` |
| ✅ | `bun test` → **15 passing / 0 failing** (integration tests drive `app.handle()` with session cookies) |
| ✅ | Error plugin, CORS, OpenAPI docs, `/health`, `/api/version` |
| ❌ | Rate limiting |
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

### UI / Design

| Status | Task |
|--------|------|
| ✅ | Shadcn (Base UI port) components, dark mode provider, toasts, responsive sidebar; inset variant enabled, single main landmark and valid mobile trigger; account menu lives in `SidebarFooter` (bottom), dropdown opens upward; logo + wordmark header; all dropdowns use styled `Select`, no native selects |
| 🟡 | `ThemeToggle` exists but is not rendered anywhere |
| ❌ | Landing page for logged-out users |
| ❌ | Favicon + meta/OG tags |
| ❌ | User settings page (sidebar "settings" item does nothing) |

### API Client & Hooks

| Status | Task |
|--------|------|
| ✅ | Typed API client, React Query hooks, mutations with invalidation |
| ✅ | `userApi.update` → `PATCH /user/profile` (route mismatch fixed) |
| ✅ | #13: `tagsApi.update` → `PATCH /tags/:id` with `useUpdateTag` mutation |

---

## 3. Fixed on 2026-09-15 (refresh session)

| Fix | Where |
|-----|-------|
| TS 6/7 tsconfig migration (`baseUrl` removed, `moduleResolution: bundler`) | `client/tsconfig*.json`, `app/tsconfig.json` |
| 11 leftover Radix `asChild` props → Base UI `render` prop | `bookmark-card.tsx`, `sidebar/*` |
| Invalid `<button><a>` nesting → `render={<Link/>}` | sidebar collections/tags/system items |
| Leftover Radix CSS var on the sidebar footer dropdown | `sidebar/footer.tsx` |
| Unsorted/Archived icons compared against a lowercase slug (backend uses "Unsorted") | `sidebar/system-items.tsx` |
| Unused `React` import | `ui/scroll-area.tsx` |
| `DELETE /collections/:id` deleted system collections before erroring | `app/src/collections/index.ts` |
| `userApi.update` hit `/user/me` instead of `/user/profile` (404 on save) | `client/src/lib/api-client.ts` |
| `re2` native build broke `bun install` on Windows → `app/bunfig.toml` sets `install.ignoreScripts = true` (re2 is unused at runtime) | `app/bunfig.toml` |
| Tests: no longer bind port 3000 (`NODE_ENV=test` guard) + authenticate with session cookies instead of a bearer token the API never supported | `app/src/index.ts`, `app/src/test/integration/*` |
| Test DB isolated from dev data (`aggregator_test`) + `db:migrate:test` script | `docker-compose.yml`, `app/drizzle.test.config.ts` |
| Vite config reads `.env.local` via `loadEnv` (the `/api` proxy never resolved env before) + pinned port | `client/vite.config.ts` |
| Drizzle migrations committed to git (were gitignored → fresh clones couldn't migrate) | `app/.gitignore` |
| Dependencies refreshed in both packages (see README) | `app/package.json`, `client/package.json` |

---

## 4. Known Bugs (open)

| Severity | Bug |
|----------|-----|
| 🟡 | Password reset emails only `console.log` the link |
| ✅ | ~~`DELETE /collections/:id` orphaned bookmarks to `collectionId = null` (invisible + un-re-addable)~~ fixed in #22: default delete re-homes to Unsorted, `?deleteBookmarks=true` destroys, parents with children blocked (409), legacy NULLs backfilled + listing is NULL-safe |
| 🟡 | `bunfig.toml` disables **all** dependency lifecycle scripts — a future dependency that genuinely needs a postinstall (sharp, esbuild) will need this revisited |

---

## 5. Priority order to ship the frontend

1. ~~**Add Bookmark dialog** (unblocks everything) → wire `useCreateBookmark`~~ ✅ #10 done
2. ~~**Edit Bookmark dialog** → wire `onEdit` → `useUpdateBookmark`~~ ✅ #11 done
3. ~~**Create/edit collection & tag dialogs** → sidebar menu items~~ ✅ #12/#13 done (parent picker respects 3-level cap)
4. ~~**Sort dropdown + FilterBadges** (backend already supports both)~~ ✅ #14 done
5. ~~**Breadcrumb collection name + active sidebar state + All Bookmarks link**~~ ✅ #15 done
6. ~~**Archive/unarchive + bulk actions in the UI**~~ ✅ #16 done
7. ~~Fix `userApi.update` route mismatch~~ ✅ done — ~~add `tagsApi.update`~~ ✅ #13 done
8. **Theme toggle placement, favicon/meta, landing page, settings page**


