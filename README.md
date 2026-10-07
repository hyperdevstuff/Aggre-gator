# Aggregator

Save links, curate them into collections, and publish the collection. Pinterest
for links, except someone sorted them — the point is getting back a *list* in a
deliberate order with reasons attached, not another single save.

- **Backend** (`app/`) — Bun + Elysia + Drizzle ORM + PostgreSQL + Better Auth
- **Frontend** (`client/`) — React + Vite + TanStack Router/Query + Tailwind + shadcn/ui (Base UI port)
- **Docs** — [thesis](docs/SPEC.md) · [roadmap](docs/ROADMAP.md) · [status tracker](docs/TASKS.md) · [design system](docs/DESIGN.md)

The private bookmark manager is essentially complete. The remaining work is the
public half — profiles, a real Explore, and the ability to save what other people
published. See the roadmap for the order and why.

## Local development

Requirements: [Bun](https://bun.com) 1.3+ and Docker (compose).

Bun monorepo — one `bun install` at the root covers both workspaces.

```bash
# 1. Database — creates `aggregator` + `aggregator_test`, persisted in a named volume
docker compose up -d

# 2. Env — both files are required; the client one is easy to forget and it breaks the API proxy
cp app/.env.example app/.env.local            # then fill in BETTER_AUTH_SECRET
cp client/.env.example client/.env.local      # VITE_PORT=5180
cp app/.env.test.example app/.env.test.local  # only needed to run tests

# 3. Install + migrate (from the repo root)
bun install
bun run db:migrate                            # dev database
bun run db:migrate:test                       # test database

# 4. Run — or just `bun run dev` for both
bun run dev:app                               # API on http://localhost:3001 (OpenAPI at /openapi)
bun run dev:client                            # Vite on http://localhost:5180
```

Every command below also works from the repo root, and the per-package form works too
(`cd app && bun run test`).

| Command (in `app/`) | What it does |
|---------------------|--------------|
| `bun run dev` | API dev server (watch mode) |
| `bun run test` | Test suite — runs against `aggregator_test`, no server needed |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:generate` / `db:migrate` / `db:migrate:test` / `db:studio` | Drizzle Kit |

| Command (in `client/`) | What it does |
|------------------------|--------------|
| `bun run dev` | Vite dev server |
| `bun run build` | `tsc -b` + production build — **must pass before committing** |
| `bun run lint` / `bun run typecheck` | ESLint / `tsc -b` |

### Ports & env

**API 3001 / client 5180**, pinned in the `.env.local` files rather than left to
framework defaults. `VITE_PORT` in `client/.env.local` and `CLIENT_URL` in
`app/.env.local` must match exactly — CORS and better-auth `trustedOrigins` both
depend on it. The `.env.example` files document every variable.

> **Windows note:** Hyper-V/WSL can reserve port ranges in the OS network stack — binds fail with
> `EADDRINUSE` even though `netstat` shows nothing, and stopping Docker/WSL does not release them.
> Pick free ports in the env files (e.g. `PORT=3001`, `VITE_PORT=5180`) or release the reservation
> with `net stop winnat && net start winnat` from an elevated shell.

### Notes

- **Dependency lifecycle scripts** are disabled in `app/bunfig.toml` (`install.ignoreScripts = true`):
  `metascraper` pulls in native `re2`, whose install script needs MSVC + Python on Windows, and which
  is never used at runtime (it only loads when `METASCRAPER_RE2=true`). Revisit this setting if a
  future dependency genuinely needs a postinstall step (e.g. `sharp`, `esbuild`).
- **Auth** uses better-auth cookie sessions. Google OAuth activates automatically when
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set. Password-reset links are currently printed to the
  API console (no mail provider wired up yet).
- **Migrations** live in `app/drizzle/` and are committed, so a fresh clone can always `db:migrate`.
- **Metadata scraping** runs after the save response returns (a single guarded fetch, no retry loop),
  so an unreachable page just keeps its hostname as the title. The fetch goes through
  `app/src/utils/url-guard.ts`, which refuses non-public addresses and re-validates every redirect hop.
- **Rate limiting** is fixed-window and in-process (`app/src/utils/rate-limit.ts`): a global
  1000/min per client plus tighter caps on `POST /bookmarks`, bulk create, and the public `/share`
  routes. Set `TRUST_PROXY=true` only when a proxy/CDN overwrites `x-forwarded-for`; counters are
  per process, so a multi-replica deploy needs a shared store.
