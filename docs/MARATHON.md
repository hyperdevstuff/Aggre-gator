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

All three sit on `478984f`. An opencode session lives in one worktree at a
time; move with `session_move`.

---

## 3. Ownership — the only rule that matters

Both worktrees contain the whole repo. The split is **by discipline, not by
directory**.

| Track | Owns | Must never touch |
|---|---|---|
| `agg-be` | `app/**`, `app/drizzle/**` | `client/**` |
| `agg-fe` | `client/**` | `app/**`, `app/drizzle/**` |
| Backend | `docs/TASKS.md` | — |
| Shared, read-only for both | `shared/**`, root `package.json`, `bun.lock` | — |

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

| ID | Issue |
|---|---|
| `be-01` | **Durable background jobs (pg-boss).** Postgres-backed queue, no new infra — Neon is already paid for. Replaces the detached `setTimeout(…, 0).unref()` in `app/src/bookmarks/index.ts:37`. Adds a `jobs` table, a worker, an `enqueue()` helper, retry with backoff, graceful shutdown. Every later wave queues here instead of fire-and-forget. |
| `be-02` | **Request logging + request-id.** Structured JSON logs, `x-request-id` propagation, timings. `TASKS.md` lists this as ❌. Without it we debug production blind — which is how the enrichment bug cost an hour. |
| `be-03` | **Fix flaky metadata enrichment** *(needs `be-01`)*. Measured on the live deploy: 4 of 7 saves lost title *and* cover; some runs returned a title with no image. Three causes: single 5s-timeout attempt with no retry; `metascraper-image` returns nothing on some pages (needs an `og:image` regex fallback); and `if (!body.title)` skips enrichment entirely, so a hand-titled bookmark can never get a cover. |

### Wave 1 — Email (Reloop) — *provider purchase pending*

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
  why fire-and-forget work gets lost (`be-03`).
- `CLIENT_URL` / `BETTER_AUTH_URL` must both be
  `https://aggre-gator.onrender.com`, exact string match, no trailing slash —
  better-auth compares the origin with `===`.
- Google OAuth is **held**: the callback cannot reach a local machine.
  Email/password is the working path.