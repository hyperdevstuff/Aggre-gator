# Aggre-gator

Modern Bookmark Manager with collection of features that helps you manage and share links more easily.

- **Backend** (`app/`) — Bun + Elysia + Drizzle ORM + PostgreSQL + Better Auth
- **Frontend** (`client/`) — React + Vite + TanStack Router/Query + Tailwind + shadcn/ui (Base UI port)
- **Docs** — [product spec](docs/SPEC.md) · [status tracker](docs/TASKS.md)

## Local development

Requirements: [Bun](https://bun.com) 1.3+ and Docker (compose).

```bash
# 1. Database — creates `aggregator` + `aggregator_test`, persisted in a named volume
docker compose up -d

# 2. Backend
cp app/.env.example app/.env.local            # then fill in BETTER_AUTH_SECRET
cp app/.env.test.example app/.env.test.local  # only needed to run tests
cd app
bun install
bun run db:migrate                            # dev database
bun run db:migrate:test                       # test database
bun run dev                                   # http://localhost:3000 (OpenAPI at /openapi)

# 3. Frontend — in a second terminal
cd client
bun install
bun run dev                                   # http://localhost:5173
```

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

The client origin must be known to the backend (`CLIENT_URL` feeds CORS and better-auth
`trustedOrigins`), so `VITE_PORT` in `client/.env.local` and `CLIENT_URL` in `app/.env.local` must
stay in sync. Defaults are **API 3000 / client 5173**; the `.env.example` files document every
variable.

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