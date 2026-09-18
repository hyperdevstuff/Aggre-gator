# Aggre-gator — Agent Notes

Bun monorepo: `app/` (Elysia + Drizzle + Postgres + Better Auth API) and `client/`
(React + Vite + TanStack Router/Query + Tailwind + shadcn on Base UI).
Product direction: `docs/SPEC.md`. Status tracker: `docs/TASKS.md`.

## Herdr (terminal management)

- **Prefer tabs over panes/splits.** Create one tab per concern (`herdr tab create --cwd <dir> --label <name>`),
  run long-lived processes (`bun run dev`) via `herdr pane run <pane-id>` inside those tabs.
- Herdr is only available when `HERDR_ENV=1` — check before using `herdr` commands.
- Dev servers currently live in tabs `wT:t9` (backend) and `wT:tA` (frontend); IDs change per session —
  use `herdr tab list` / `herdr pane list` to rediscover.

## Commands (run from repo root)

```bash
bun install            # installs both workspaces (root bunfig.toml disables lifecycle scripts — required, see below)
bun run dev            # backend + frontend together
bun run dev:app        # backend only (watch mode)
bun run dev:client     # frontend only (Vite)
bun run test           # backend test suite (against aggregator_test DB)
bun run typecheck      # both packages
bun run lint           # both packages
bun run build          # production build (must pass before committing)
bun run db:up          # start Postgres via docker compose
bun run check:db       # bounded DB probe with actionable errors
bun run db:migrate     # apply migrations (dev DB)
bun run db:migrate:test # apply migrations (test DB)
```

Per-package scripts also work (`cd app && bun run test`).

## Dev environment facts

- **Ports are pinned in `.env.local` files, not defaults:** API listens on **3001**
  (`PORT` in `app/.env.local`), Vite on **5180** (`VITE_PORT` in `client/.env.local`).
  `CLIENT_URL` in `app/.env.local` must match the Vite port exactly — CORS and
  better-auth `trustedOrigins` depend on it. Both files must exist (copy from
  `.env.example`); `client/.env.local` was previously missing and broke the API proxy.
- **Postgres runs in Docker** (`docker compose up -d db`). `aggregator_test` is created by
  `docker/initdb/01-create-test-db.sql` on first volume boot only. Tests fail with
  connection timeouts if the DB is down — run `bun run check:db` to diagnose.
- **Root `bunfig.toml` sets `ignoreScripts = true`** (mirrors `app/bunfig.toml`). Without it,
  `re2` (a metascraper dep) tries to native-build and fails. re2 is unused at runtime.
  If a future dependency genuinely needs postinstall, revisit both files together.
- **Single root lockfile** (`bun.lock`); per-package lockfiles were removed in the workspace migration.
- Docker daemon is not always running in this environment — DB-backed tests fail with
  hook timeouts if so. Check `docker compose ps` first.

## Frontend conventions

- **shadcn/ui on the Base UI port.** Use the existing components in `client/src/components/ui/`.
- Base UI uses the **`render` prop, not Radix's `asChild`** — e.g. `render={<Link to="..." />}`.
- Dialogs that need fresh state per open: keep the outer component as a static shell
  (title/description) and put form state in an inner form component that mounts on open.
  Do NOT reset state via `useEffect` — the `react-hooks/set-state-in-effect` lint rule rejects it.
- Icon-only buttons need `aria-label`. Dialogs guard dismissal while a mutation is pending.
- Forms: fieldsets disabled while pending, errors via `role="alert"`, labels via `htmlFor`.

## Skills

Frontend/design work should follow (when available): frontend-design, shadcn,
fixing-accessibility, 12-principles-of-animation, emil-design-eng,
make-interfaces-feel-better. Note: only `fixing-accessibility`,
`12-principles-of-animation`, `emil-design-eng`, and `make-interfaces-feel-better`, `frontend-design` and `shadcn`.

## API gotchas

- `GET /bookmarks` returns `tags` as **objects** `{id, name, color}`, but write endpoints
  accept `tags: string[]` (names). `Bookmark.tags` is the object form.
- `GET /collections` returns `bookmarkCount`, not `count` — `collectionsApi.list` maps it.
- Bookmark `PATCH /:id/archive` → `:id/unarchive`; delete requires archive first (409 otherwise).
- Scraping metadata is best-effort: 404s/dead URLs fall back to hostname and log a single-line warning.
