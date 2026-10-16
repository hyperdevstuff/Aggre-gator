# ADR-003 — Background jobs are rows in our own Postgres

> Status: **accepted** · Wave 0 (`be-01`) · 2026-10-16

## Context

`POST /bookmarks` used to scrape metadata for a saved URL with a detached
`setTimeout(..., 0).unref()`. The work ran inside the request process, so
anything that ended the process first lost it.

That is not hypothetical on the current deploy. The Render free tier sleeps
after ~15 min idle and takes ~1 min to wake; the service is also replaced on
every deploy. Measured on the live deploy: **4 of 7 saves lost both title and
cover**, and some runs returned a title with no image.

`docs/TASKS.md` had this filed as 🟡 "still in-process fire-and-forget", and the
obvious fix named in the issue was pg-boss.

## Decision

A durable queue implemented directly against the `jobs` table:
`app/src/utils/jobs.ts`, migration `0012_jobs.sql`.

- Workers claim work with `FOR UPDATE SKIP LOCKED`.
- Retry uses exponential backoff written to `run_at`, not a sleep.
- A crashed worker's job is reclaimed once its `locked_at` lease expires.
- Settled rows are purged after 24h so the table cannot grow without bound.

No new dependency.

## Why not pg-boss

pg-boss is a good library and would be the right call with several job types or
scheduling. It was rejected here for three reasons, in order of weight:

1. **Schema ownership.** pg-boss manages ~10 tables in its own `pgboss` schema.
   This repo keeps hand-written migrations committed to git as the single source
   of truth — `0010`/`0011` are deliberately outside drizzle-kit's snapshot
   lineage. Adopting pg-boss splits schema ownership in two, where drizzle-kit
   cannot see half of it and no migration here would ever touch it. That is a
   permanent tax, not a one-time cost.

2. **Paying for a platform we would not use.** It ships cron, priority queues,
   singleton guards and batch tuning. The roadmap has exactly one job type
   (`enrich-metadata`) through `be-25`.

3. **The dependency rule.** `bun.lock` is read-only for both marathon tracks, so
   adding a package costs a PR to `main` plus a rebase on both branches.

The decisive point is smaller than the first two: the one primitive we actually
need is `FOR UPDATE SKIP LOCKED`, which is a single query. Everything else in
pg-boss is unused surface.

## What we own as a result

Retry, backoff, lease expiry and retention are ours to get right, and the tests
assert each of them directly against the table rather than inferring them from a
route's behaviour (`app/src/test/util/jobs.test.ts`). The specific risks:

- **A job that exhausts `max_attempts` is buried as `failed`, keeping
  `last_error`** — never deleted, because a dead enrichment is exactly what you
  want to find in the database.
- **A missing handler is a failure, not a drop.** An unknown `type` fails the
  job loudly instead of being silently discarded.
- **A reaped job keeps its incremented `attempts`**, so a job that reliably
  kills its worker still runs out of attempts instead of looping forever.
- **Backoff is a column.** A restart resumes the schedule rather than resetting
  it, and a failing job costs a row and no open timer.

## Consequences

- A Render sleep no longer loses work. Jobs accumulate and run on wake — which
  is the failure mode working as intended, not a regression.
- `SIGTERM` drains in-flight work before exit, so a deploy does not abandon a
  claimed job (it would be reclaimed by the lease anyway, but only after
  `LOCK_LEASE_MS`).
- The worker does **not** start under `NODE_ENV=test`; tests drive `runOnce()`
  directly, so assertions never race a polling loop. The existing enrichment
  tests were converted from `setTimeout` polling to explicit ticks, which
  removed their timing races.
- **Revisit if** several job types land that would each want cron, per-queue
  concurrency, or priority. At that point a `job_type` column and a second
  worker loop may not be enough, and re-evaluating pg-boss would be reasonable.