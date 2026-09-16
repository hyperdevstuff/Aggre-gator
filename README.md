# Aggre-gator

Self-hosted bookmark manager.

- **Backend** (`app/`) — Bun + Elysia + Drizzle ORM + PostgreSQL + Better Auth
- **Frontend** (`client/`) — React + Vite + TanStack Router/Query + Tailwind + shadcn/ui (Base UI port)
- **Status/TODO tracker** — [`client/TASKS.md`](client/TASKS.md)

## Local dev environment

Requirements: [Bun](https://bun.com) 1.3+ and Docker (Docker Desktop / compose).

```bash
# 1. Postgres 18 (creates `aggregator` + `aggregator_test` databases, persists in a named volume)
docker compose up -d

# 2. Backend
cp app/.env.example app/.env.local      # then fill in BETTER_AUTH_SECRET
cd app && bun install
bun run db:migrate                      # apply migrations to the dev database
bun run db:migrate:test                 # apply migrations to the test database
bun run dev                             # http://localhost:3000  (API + OpenAPI docs at /openapi)

# 3. Frontend (new terminal)
cd client && bun install
bun run dev                             # http://localhost:5173
```

| Command (in `app/`) | What it does |
|---------------------|--------------|
| `bun run dev` | API dev server with watch mode |
| `bun run test` | Test suite (uses `aggregator_test`, no server needed) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:generate` / `db:migrate` / `db:studio` | Drizzle Kit |

| Command (in `client/`) | What it does |
|------------------------|--------------|
| `bun run dev` | Vite dev server |
| `bun run build` | `tsc -b` + production build — **must pass before committing** |
| `bun run lint` / `typecheck` | ESLint / `tsc -b` |

### Ports & env

The client origin must be known to the backend (`CLIENT_URL` → CORS + better-auth `trustedOrigins`),
so `VITE_PORT` in `client/.env.local` and `CLIENT_URL` in `app/.env.local` have to stay in sync.
Defaults are **API 3000 / client 5173**; both are configurable through the env files
(`.env.example` documents every variable). Tests use their own `aggregator_test` database,
so `bun test` never touches dev data.

> **Windows note:** Hyper-V/WSL can reserve port ranges at the OS network-stack level — binds fail
> with `EADDRINUSE` even though `netstat` shows nothing (Docker Desktop/WSL being stopped does not
> release them). If 3000/5173 are affected on your machine, pick free ports in the env files
> (e.g. `PORT=3001`, `VITE_PORT=5180`) or release the reservation with
> `net stop winnat && net start winnat` from an elevated shell.

### Dependency lifecycle scripts

`app/bunfig.toml` sets `install.ignoreScripts = true`. This is deliberate: `metascraper` pulls in
the native `re2` package, whose install script requires MSVC + Python and fails on Windows without
them — and `re2` is never used at runtime (it is only loaded when `METASCRAPER_RE2=true`). If a
dependency ever needs a genuine postinstall step (e.g. `sharp`, `esbuild`), remove that setting or
run `bun install --ignore-scripts` selectively.

### Auth

Better Auth runs with cookie sessions. Email/password is enabled; Google OAuth activates
automatically when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set. Password-reset emails
currently print the reset link to the API console.

