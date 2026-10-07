# `app/` — API

Bun + Elysia + Drizzle ORM + PostgreSQL + Better Auth. Serves the JSON API on
**port 3001** (pinned in `.env.local`, not the Elysia default). Full setup and
the command table live in the top-level [`README.md`](../README.md).

## Layout

| Path | What |
|---|---|
| `src/index.ts` | App assembly: CORS, error plugin, global rate limit, OpenAPI, route mounting |
| `src/env.ts` | Fail-fast env validation — imported first, so a missing `DATABASE_URL` surfaces with a fix hint |
| `src/db/schema.ts` | Drizzle tables + relations (the `user`/`session`/`account`/`verification` block is Better Auth's) |
| `src/bookmarks/` | `index.ts` (CRUD + create), `$id.ts`, `bulk.ts` |
| `src/collections/` | CRUD, tree, slug lookup, share create/get/revoke |
| `src/share/` | Public: `GET /share/explore` directory and `GET /share/:code` |
| `src/utils/` | `url-guard.ts` (SSRF), `rate-limit.ts`, `metadata.ts` (scraping), `auth.ts`, `pagination.ts` |
| `src/test/` | Integration tests drive `app.handle()` with session cookies; unit tests cover the guard and limiter |
| `drizzle/` | Committed migrations — a fresh clone can always `db:migrate` |
| `../../shared/collection-tree.ts` | The 3-level nesting rule, shared with the client |

## Notes

- Tests bind no port (`NODE_ENV=test` guard) and authenticate with a session
  cookie, because that is the only auth the API supports.
- `bunfig.toml` sets `install.ignoreScripts = true` — `metascraper` pulls a native
  `re2` that fails to build on Windows and is never used at runtime.
- See the top-level README for ports, env vars, scraping behaviour and rate limits.