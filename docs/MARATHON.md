# Marathon — two-track parallel development

> Operational contract for the long build. **Direction** lives in
> [`ROADMAP.md`](ROADMAP.md). **Per-area status** lives in
> [`TASKS.md`](TASKS.md). This file is *how we work*: worktrees, ownership,
> issue IDs, and the rules that keep two agents from colliding.

---

## 1. Session start prompt (paste this into a fresh agent)

```
Working on Aggregator. Read AGENTS.md, then docs/MARATHON.md — that file has
the worktree layout, ownership rules and my issue list. Read only the docs the
task needs; do not re-read the whole repo.

Worktree: agg-be (branch feat/be-marathon) | agg-fe (branch feat/fe-marathon).
I will tell you which. Stay strictly inside that worktree's owned paths —
see the ownership table in docs/MARATHON.md. Never touch the other worktree's
files, never write a migration from agg-fe, never edit client/ from agg-be.

Definition of done for every issue: bun run typecheck + bun run lint +
bun run test pass, docs/TASKS.md updated to match reality, and any new API
surface has an integration test. Open a PR to main; do not merge main yourself.
```

**Why that works:** it points at exactly three files instead of dumping the
tree into context. `AGENTS.md` already carries the commands, the API gotchas
and the naming rules.

---

## 2. Worktree layout

| | Path | Branch |
|---|---|---|
| Primary (merge target) | `/home/hyper/web/aggregator` | `main` |
| Backend track | `…/opencode/worktree/8815c6/agg-be` | `feat/be-marathon` |
| Frontend track | `…/opencode/worktree/8815c6/agg-fe` | `feat/fe-marathon` |

`main` is now at `2084b46` (`be-01` + `be-02`, PR #23). An opencode session
lives in one worktree at a time; move with `session_move`.

**A new worktree starts bare** — `node_modules`, `.env.local` and
`.env.test.local` are all gitignored and do not travel with it. Copy them from
the primary checkout rather than running `bun install`: the deps are installed
per-workspace (no symlinks to re-link), and `bun install` would rewrite the
shared `bun.lock` that rule 3 protects. Then `bun run db:up` and
`bun run db:migrate:test`.

---

## 3. Ownership — the only rule that matters

Both worktrees contain the whole repo. The split is **by discipline, not by
directory**.

| Track | Owns | Must never touch |
|---|---|---|
| `agg-be` | `app/**`, `app/drizzle/**`, `docs/TASKS.md`, `docs/decisions/**` | `client/**` |
| `agg-fe` | `client/**` | `app/**`, `app/drizzle/**` |
| Shared, read-only for both | `shared/**`, root `package.json`, `bun.lock` | — |
| Shared, either may edit (low risk) | `docs/MARATHON.md` | — |

**`docs/decisions/` is now assigned to the backend.** It was previously
unowned, which `be-01` exposed: the queue decision needed writing down and the
table had no answer. If `agg-fe` starts writing design ADRs, renumber before
committing rather than after — ADR numbers are the only thing here that can
collide silently.

**Conflicts we are avoiding, and why:**

1. **Migration numbering.** Two agents generating `0012_*` independently is the
   single most likely merge conflict. Only `agg-be` writes migrations.
2. **`docs/TASKS.md`.** Both agents want to mark things done. Backend owns it;
   the frontend updates it once, at the end of its branch.
3. **Root `package.json`.** A dependency bump lands as its own PR to `main`
   first, then both branches rebase.
4. **Never merge worktree-to-worktree.** `feat/be-marathon` → `main`, and
   `feat/fe-marathon` → `main`. Never `fe` → `be`.

---

## 4. Contract-first, because the frontend would otherwise stall

The frontend needs endpoints that do not exist yet: analytics (`be-16`), plan
enforcement (`be-19`), checkout + portal (`be-21`), verification status (`be-06`).

**Backend publishes response shapes early** — a branch plus the TypeScript
types and the endpoint signature — even when the implementation is not merged
yet. The frontend builds against those types with mocked data. Otherwise the
frontend stalls for a week waiting on migrations.

---

## 5. Backend issue list (`agg-be`)

Ownership: `app/**`, `app/drizzle/**`. Every wave ends green.

### Wave 0 — Foundations *(everything else is unsafe without these)*

| ID | Status | Issue |
|---|---|---|
| `be-01` | ✅ **done** | **Durable background jobs.** Postgres-backed queue, no new infra — Neon is already paid for. Replaces the detached `setTimeout(…, 0).unref()` that lost enrichment work on every Render sleep and deploy. Adds a `jobs` table, a worker, an `enqueue()` helper, retry with backoff, graceful shutdown. Every later wave queues here instead of fire-and-forget. |
| `be-02` | ✅ **done** | **Request logging + request-id.** Structured JSON logs, `x-request-id` propagation, timings. `TASKS.md` listed this as ❌. Without it we debug production blind — which is how the enrichment bug cost an hour. |
| `be-03` | ⏳ **next** | **Fix flaky metadata enrichment** *(needs `be-01`)*. See the corrected diagnosis below — the original one was wrong in its second cause. |

#### `be-01` — what actually shipped

Hand-rolled, **not pg-boss**. `ADR-003` records why: pg-boss manages ~10 tables
in its own `pgboss` schema, which would split schema ownership away from this
repo's hand-written committed migrations, and it ships cron/priority/singleton
features no roadmap job uses. The one primitive needed is a single
`FOR UPDATE SKIP LOCKED` query.

- `app/src/utils/jobs.ts` — claim, retry with backoff, `locked_at` crash lease,
  24h purge of settled rows
- `app/src/utils/enrichment.ts` — the one handler, kept out of the queue module
  so the queue stays generic
- Migration `0012_jobs`, ADR-003, 17 unit tests

**Two things it changed that later waves inherit.** The worker does *not* start
under `NODE_ENV=test`; tests drive `runOnce()` directly, which is why the
enrichment tests dropped their `setTimeout` polling and timing races. And a
test failure during `be-01` exposed that the queue had **no retention sweep** —
one row per bookmark save, forever — so settled rows are now purged.

#### `be-03` — corrected diagnosis (do not start from the original spec)

The measured symptom stands: 4 of 7 saves lost title *and* cover, and some runs
returned a title with no image. But **the second cause in the original spec is
wrong**, and building it as written would have wasted the time:

| Original claim | What is actually true |
|---|---|
| *"`metascraper-image` returns nothing on some pages (needs an `og:image` regex fallback)"* | **Wrong.** Tested against single quotes, unquoted attrs, uppercase `OG:`, protocol-relative URLs, JSON-LD, `og:image` inside `<body>`, and odd title whitespace — metascraper handled **all** of them. The real cause is the **512KB body cap**: `<title>` sits early in `<head>`, `og:image` often much later, so the cap truncates precisely between them. Reproduced: `title:"Real Title", image:null`. **A regex fallback reading the same truncated HTML would find nothing.** |

The other two causes are confirmed as written: a single 5s attempt with no
retry, and `if (!body.title)` at `app/src/bookmarks/index.ts:109` skipping
enrichment entirely so a hand-titled bookmark can never get a cover.

**Planned fix:** extract `<head>` preferentially so metadata wins even when a
page front-loads megabytes of inline script — keeping 512KB as a real DoS
ceiling rather than raising it. Always enqueue, and let the handler decide
per-field so the placeholder guard still protects a user's title.

**Still open:** our scraper sends `User-Agent: BookmarkBot/1.0`, and
`crawler.ts` treats *any* UA containing `bot` as a link-preview crawler. Many
sites serve bot UAs a stripped page, which would produce missing titles *and*
covers together — a plausible second contributor to the 4-of-7 rate that cannot
be confirmed without live traffic. Worth watching on the live deploy before
changing it.

#### Framework notes worth carrying forward

`app/src/utils/ELYSIA-NOTES.md` — two Elysia behaviours that silently broke
`be-02` and will bite `agg-fe` too:

1. **`.use()` order is registration order.** A plugin's hooks only cover routes
   registered *after* it. The logger is now the first `.use()` in
   `src/index.ts`, above `/health`.
2. **`.error({ Class })` handlers beat any `onError`.** So `errorPlugin`'s
   registered `ApiError` subclasses bypassed the logger's `onError` entirely —
   success paths logged, every 401/404/409 did not. If you add a class to
   `.error({...})`, it needs the `attachRequestId` + `logRequest` pair too.

Also fixed in passing: `ApiError.toResponse()` builds a fresh `Response` and
discarded `set.headers`, so any header a plugin attached was dropped on error
responses (`Retry-After` survived only by being set on the `Response` itself).

#### Baseline

**248 passing / 0 failing across 26 files** (was 203/23 when Wave 0 started).
typecheck and lint clean, build clean. The 20 lint warnings are all
pre-existing `react-refresh` ones in `client/` — not ours, and `agg-fe`'s.

### Wave 1 — Email (Reloop) — *provider purchase pending*

> **Unblocked and ready to start:** `be-05`, `be-06`, `be-07`. None need the
> domain — they need `be-04`'s mailer, which is a no-op in dev/test. Only
> `be-04`'s *send-test* is blocked.

| ID | Issue |
|---|---|
| `be-04` | **Mailer module.** `app/src/utils/mail.ts`, provider-agnostic, **no-op in dev/test** so tests never hit the network. Templates as HTML strings (avoids a build step). `MAIL_PROVIDER=none\|reloop`, `RELOOP_API_KEY`, `RELOOP_FROM`. |
| `be-05` | **Real password reset.** Replaces the `console.log` at `app/src/utils/auth.ts:21`. Small, unblocks the module. |
| `be-06` | **Email verification flow.** better-auth `emailVerification.sendVerificationEmail` + `requireEmailVerification: true`, `sendOnSignIn: true`. `user.emailVerified` and the `verification` table already exist — verify indexes before writing a migration. |
| `be-07` | **Verification gates publishing.** `TASKS.md` is explicit: gates *who may publish*, not who may exist. |
| `be-08` | **Domain + DNS.** ⚠️ **human task, blocks `be-04` send-test.** Buy domain, add to Reloop, verify DKIM/SPF/DMARC. Agent does config wiring; human does the purchase and DNS records. |

### Wave 2 — Phase 5 social loop

| ID | Issue |
|---|---|
| `be-09` | **`normalizeUrl()`** — pure, unit-tested, no schema change. ADR-001 step 1, deliberately first. Conservative posture: keep ambiguous params. **Do not lowercase path, do not strip `www`.** |
| `be-10` | **`links` table** — migration + `bookmarks.linkId` nullable. `url_key` indexed but **not unique**; soft near-duplicate hints only. ADR-001 step 2. |
| `be-11` | **Save someone else's link** — creates/reuses a `links` row, maintains `saveCount`. Now `url_key` becomes unique. ADR-001 step 3. |
| `be-12` | **Fork a shared collection** — deep copy bookmarks + `collection_items` positions into the caller's tree. |
| `be-13` | **Follows** — table + follow/unfollow + counts. Feeds the profile page phase 3 stubbed. |
| `be-14` | **View counts** — data source for *both* analytics and the `sort=top` ranking upgrade. |

### Wave 3 — Analytics (the paid feature that converts)

| ID | Issue |
|---|---|
| `be-15` | **`share_views` table** — collection/share id, referrer, timestamp, day bucket. No raw IP. |
| `be-16` | **Owner analytics endpoints** — views/day, referrer breakdown, top bookmarks per share. Paid tier #2 in `SPEC.md`. **Contract published early for `agg-fe`.** |
| `be-17` | **Real ranking** — `sort=top` switches from the subtree-count proxy to saves + views, recency tiebreak. |

### Wave 4 — Monetization (Dodo Payments)

| ID | Issue |
|---|---|
| `be-18` | **Custom domain on Render.** ⚠️ **human task, blocks Dodo.** `DEPLOY.md` flags it: branded checkout and webhook allow-lists need it. Ops work, do it early. |
| `be-19` | **Plan enforcement at the API layer** — never UI-only. `user.plan` exists and is never enforced. Add a `PLANS` config + `requirePlan()` guard on share/publish routes. Free: N active public links, M bookmarks per public collection. |
| `be-20` | **`subscriptions` table** — dodo subscription id, status, plan, period end, customer. |
| `be-21` | **Checkout + customer portal** — server creates the Dodo checkout session, client redirects to `checkout_url`. **Contract published early.** |
| `be-22` | **Webhook handler** — all 9 subscription events. The distinction that must not be fudged: `subscription.failed` is **terminal → never grant access**; `subscription.on_hold` is **recoverable** via `updatePaymentMethod`. Needs signature verification, idempotency, replay safety. |

### Wave 5 — Cross-cutting

| ID | Issue |
|---|---|
| `be-23` | **Moderation + reporting** — required the moment content is public. |
| `be-24` | **Shared rate-limit store** — `TASKS.md` 🟡: counters are per-process, so limits mean nothing multi-replica. |
| `be-25` | **Admin/moderation surface** — only if `be-23` needs it. |

---

## 6. Frontend issue list (`agg-fe`)

Ownership: `client/**`. **Design in paper-rs first, then code.**

### Step 1 — Design boards (paper-rs)

paper-rs serves MCP only while the app is open; if the tool is unreachable,
ask the human to launch it.

| ID | Board |
|---|---|
| `fe-01` | **Account page** — overview, *not* a settings redesign. Six rows: header, stats strip, plan & usage, public presence, recent activity, security. Each row marked **live now** vs **waits on `be-06`/`be-16`**. |
| `fe-02` | **Dashboard** — grid density, filter+sort bar, empty/loading/error states. |
| `fe-03` | **Bookmark card family** — with cover / no cover / **broken image** / enriching skeleton / selection. The broken-image state is where the `be-03` bug becomes invisible instead of alarming. |
| `fe-04` | **Sidebar** — depth-3 tree, counts, active state, drop target for move, collapse. |
| `fe-05` | **Explore** — masonry, mosaic covers, facet chips, search, empty state. |
| `fe-06` | **Billing + analytics screens** — against `be-16`/`be-19`/`be-21` contracts. |
| `fe-07` | **Token reference** — wet-slate palette, type scale, motion. |

### Step 2 — Code, in dependency order

| ID | Issue |
|---|---|
| `fe-08` | Design tokens → card family (incl. broken/loading states) |
| `fe-09` | Sidebar — real upgrade from the current name/plan/settings/sign-out menu |
| `fe-10` | Dashboard |
| `fe-11` | Explore |
| `fe-12` | Account page — live rows first, no empty shells |
| `fe-13` | Billing + analytics screens |

---

## 7. Design rules that are not negotiable

From `DESIGN.md`, and each one exists because it was measured:

- **Clay accent on exactly one thing per viewport.** Reserved for the share
  button, the live dot, view-count numerals, the active nav rule. Never on
  headings, icons, ordinary links, or gradients. *If clay is on screen twice,
  one of them is wrong.*
- **White text on clay is 1.7:1** — clay fills take the ground as ink.
- **No drop shadows in dark.** Depth = surface lightness + 1px hairline + 6%
  white inner top highlight.
- **`ease-in` is banned** — it holds still while the eye is watching hardest.
  Durations 120/180/260, exit always faster than enter. Enter from
  `scale(0.95)`, never `scale(0)`.
- **Type:** Newsreader for anything making a claim; Geist for body; Geist Mono
  for machine facts only (counts, codes, timestamps, eyebrows).
- **Do not start phase 3+ before phase 2** — that ordering is load-bearing,
  see `ROADMAP.md` §7.

---

## 8. Live deploy notes

- `https://aggre-gator.onrender.com` — single Render web service, root
  `Dockerfile`, free tier + Neon Postgres.
- The service **sleeps after ~15 min idle** and takes ~1 min to wake. This is
  why fire-and-forget work gets lost (`be-03`) — and why the durable queue
  (`be-01`) is a *fix*, not an optimisation: jobs accumulate while asleep and
  run on wake. A sleeping worker is the failure mode working.
- **Structured logs are live** (`be-02`): one JSON line per request on stdout,
  `x-request-id` on every response. Two deliberate omissions — query strings and
  emails are never logged, because share codes and reset tokens travel in URLs.
  Monitoring/alerting on top of this is still ❌ in `TASKS.md`; log lines are
  the prerequisite, not the feature.
- **Migration `0012_jobs.sql` must exist before this deploys.** Render runs
  migrations on boot, so it is automatic — but a `jobs`-less database logs a
  `42P01` on every boot rather than failing loudly.
- `CLIENT_URL` / `BETTER_AUTH_URL` must both be
  `https://aggre-gator.onrender.com`, exact string match, no trailing slash —
  better-auth compares the origin with `===`.
- Google OAuth is **held**: the callback cannot reach a local machine.
  Email/password is the working path.