-- Wave 0 — durable background jobs.
--
-- Replaces the detached `setTimeout(..., 0).unref()` that `POST /bookmarks`
-- used for metadata enrichment. That pattern ran the work inside the request
-- process, so a Render free-tier sleep (~15 min idle, ~1 min to wake) or any
-- deploy mid-flight silently discarded the job — measured at 4 of 7 live saves
-- losing both title and cover.
--
-- The queue is this table. A worker claims rows with `FOR UPDATE SKIP LOCKED`,
-- which is the standard Postgres pattern for "many workers, one shared queue":
-- a locked row is skipped rather than waited on, so N processes drain one queue
-- without ever handing the same job to two of them, and no broker is needed.
--
-- `locked_at` is the crash lease. A worker killed mid-job leaves the row
-- `active` with a stale lock; reaping (see `jobs.ts`) returns it to `pending`
-- once the lease expires, so a crash costs one retry rather than a stuck job.
--
-- Backoff is stored in `run_at` instead of being slept on: a failing job costs
-- a row and no timer, and a restart resumes the schedule instead of resetting
-- it.

CREATE TABLE IF NOT EXISTS "jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "run_at" timestamp DEFAULT now() NOT NULL,
  "locked_at" timestamp,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- The claim query is `WHERE status = 'pending' AND run_at <= now() ORDER BY
-- run_at`; this index is that query's entire cost model.
CREATE INDEX IF NOT EXISTS "jobs_claimable_idx" ON "jobs" ("status", "run_at");