/**
 * Durable background jobs, queued in Postgres.
 *
 * Replaces the detached `setTimeout(..., 0).unref()` that `POST /bookmarks`
 * used for metadata enrichment. That pattern ran the work inside the request
 * process, so a Render free-tier sleep (~15 min idle) or a deploy mid-flight
 * silently dropped it — measured on the live deploy at 4 of 7 saves losing
 * both title and cover.
 *
 * Why a hand-rolled queue rather than pg-boss (ADR-003): pg-boss manages ~10
 * tables in its own `pgboss` schema, which would split schema ownership away
 * from this repo's hand-written, committed migrations — drizzle-kit cannot see
 * them and no migration here would ever touch them. The one primitive actually
 * needed is `FOR UPDATE SKIP LOCKED`, which is a single query.
 *
 * The trade is deliberate: retry/backoff/lease semantics below are ours to get
 * right, and nothing else (cron, priority queues, batch tuning) is used by the
 * roadmap. If several job types with scheduling ever land, revisit this.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { jobs } from "../db/schema";

export type JobType = "enrich-metadata";

export type JobPayloads = {
  "enrich-metadata": {
    bookmarkId: string;
    /** The shared link for this URL, if one exists. Its preview is updated too. */
    linkId: string | null;
    url: string;
    /** The bookmark still holding this title is ours to overwrite. */
    placeholderTitle: string;
    /**
     * Whether the scraped title may overwrite `placeholderTitle`.
     *
     * `false` when the user supplied their own title at save time. The
     * description and cover are still enriched in that case — skipping the whole
     * job (which is what this flag replaced) meant a hand-titled bookmark could
     * never get a cover.
     */
    fillTitle: boolean;
    /** User-supplied values win over scraped ones. */
    keep: { description: string | null; cover: string | null };
  };
};

/** How often the worker looks for claimable work when the queue is empty. */
const IDLE_POLL_MS = 2_000;
/** Rows claimed per tick. Small on purpose: one enrichment is a network fetch. */
const BATCH_SIZE = 5;
/** A job whose worker died is reclaimed after this long. */
const LOCK_LEASE_MS = 60_000;
/** First backoff step; doubles per attempt (1s, 2s, 4s, 8s…). */
const BASE_BACKOFF_MS = 1_000;
/**
 * How long a finished job is kept before being deleted.
 *
 * The queue would otherwise grow without bound — one row per bookmark save,
 * forever. A day is long enough to investigate a failure after the fact
 * (`last_error` is the only record of why enrichment died) and short enough that
 * the table stays an index-sized working set.
 */
const COMPLETED_RETENTION_MS = 24 * 60 * 60 * 1_000;

export type Handlers = {
  [T in JobType]: (payload: JobPayloads[T]) => Promise<void>;
};

let handlers: Handlers | null = null;

/** Register the handlers the worker dispatches to. Called once at boot. */
export function registerJobHandlers(next: Handlers) {
  handlers = next;
}

function backoffMs(attempts: number) {
  return BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1);
}

/**
 * Put a job on the queue. Never throws on a worker failure — the job is the
 * durable record, and the response must not wait on it.
 */
export async function enqueue<T extends JobType>(
  type: T,
  payload: JobPayloads[T],
  options: { maxAttempts?: number } = {},
) {
  const [row] = await db
    .insert(jobs)
    .values({
      type,
      payload: payload as Record<string, unknown>,
      maxAttempts: options.maxAttempts ?? 5,
    })
    .returning({ id: jobs.id });
  return row.id;
}

/**
 * Claim up to `BATCH_SIZE` due jobs.
 *
 * The `FOR UPDATE SKIP LOCKED` subselect is what makes this safe with more than
 * one worker: a row another worker holds is skipped, not blocked on. The outer
 * UPDATE then marks the claimed rows `active` and stamps the lease in one
 * round trip.
 */
async function claimBatch() {
  return db.execute(sql`
    UPDATE "jobs" j
    SET "status" = 'active',
        "locked_at" = now(),
        "attempts" = j."attempts" + 1,
        "updated_at" = now()
    WHERE j."id" IN (
      SELECT "id" FROM "jobs"
      WHERE "status" = 'pending' AND "run_at" <= now()
      ORDER BY "run_at"
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING j."id", j."type", j."payload", j."attempts", j."max_attempts"
  `);
}

type ClaimedRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

/**
 * Return dead workers' jobs to the queue.
 *
 * A worker killed mid-job never gets to release its row, so without this a
 * crash strands the job in `active` forever. Anything whose lease has expired
 * goes back to `pending`; the attempt counter is untouched, so a job that
 * repeatedly kills its worker still exhausts `max_attempts` and stops.
 */
async function reapExpiredLocks() {
  return db.execute(sql`
    UPDATE "jobs"
    SET "status" = 'pending',
        "locked_at" = NULL,
        "run_at" = now(),
        "updated_at" = now()
    WHERE "status" = 'active'
      AND "locked_at" < now() - (${LOCK_LEASE_MS} * interval '1 millisecond')
  `);
}

/**
 * Delete finished jobs older than the retention window.
 *
 * Runs on its own slow cadence rather than every tick: it is a `DELETE`, and
 * `completed_at`/the row's own `updated_at` is not indexed, so the scan touches
 * only settled rows.
 */
async function purgeSettled() {
  return db.execute(sql`
    DELETE FROM "jobs"
    WHERE "status" IN ('completed', 'failed')
      AND "updated_at" < now() - (${COMPLETED_RETENTION_MS} * interval '1 millisecond')
  `);
}

async function complete(id: string) {
  await db
    .update(jobs)
    .set({ status: "completed", lockedAt: null, lastError: null, updatedAt: new Date() })
    .where(sql`${jobs.id} = ${id}`);
}

/**
 * Record a failure and schedule the retry — or bury the job when it is out of
 * attempts. Terminal failures stay `failed` with `last_error` rather than being
 * deleted: a dead enrichment is exactly the thing you want to find in the DB.
 */
async function fail(row: ClaimedRow, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = row.attempts >= row.max_attempts;
  await db
    .update(jobs)
    .set({
      status: exhausted ? "failed" : "pending",
      lockedAt: null,
      lastError: message.slice(0, 1_000),
      runAt: exhausted
        ? new Date()
        : new Date(Date.now() + backoffMs(row.attempts)),
      updatedAt: new Date(),
    })
    .where(sql`${jobs.id} = ${row.id}`);
}

export type RunOnceResult = { processed: number; failed: number };

/**
 * Drain the currently-claimable jobs and return. Exported for tests, which need
 * a deterministic tick rather than a background loop.
 */
export async function runOnce(options: { purge?: boolean } = {}): Promise<RunOnceResult> {
  await reapExpiredLocks();
  if (options.purge) await purgeSettled();
  // `db.execute` is untyped by design; the RETURNING clause above is the
  // contract, so the rows are asserted into shape here rather than trusted.
  const claimed = (await claimBatch()) as unknown as { rows?: ClaimedRow[] };
  const rows = claimed.rows ?? [];
  let failed = 0;

  for (const row of rows) {
    try {
      const handler = handlers?.[row.type as JobType];
      if (!handler) throw new Error(`no handler registered for job type "${row.type}"`);
      await handler(row.payload as never);
      await complete(row.id);
    } catch (error) {
      failed += 1;
      await fail(row, error);
    }
  }

  return { processed: rows.length - failed, failed };
}

export type Worker = { stop: () => Promise<void> };

/** How many idle polls between retention sweeps (~1h at IDLE_POLL_MS). */
const PURGE_EVERY_POLLS = 1_800;

/**
 * Start the polling worker.
 *
 * Deliberately not started under `NODE_ENV=test`: tests drive `runOnce()`
 * directly so assertions never race a background loop.
 */
export function startWorker(): Worker | null {
  if (handlers === null) {
    console.warn("[jobs] startWorker called before registerJobHandlers — no work will run");
  }

  let running = true;
  let ticking = false;
  let pollsSincePurge = 0;

  const tick = async () => {
    // Re-entrancy guard: a slow batch must not overlap the next timer.
    if (!running || ticking) return;
    ticking = true;
    try {
      // Keep draining while batches keep coming back full — an idle queue
      // should cost one query per poll interval, not spin. eslint-disable-next-line no-constant-condition
      while (running) {
        const dueForPurge = pollsSincePurge >= PURGE_EVERY_POLLS;
        if (dueForPurge) pollsSincePurge = 0;
        const { processed, failed } = await runOnce({ purge: dueForPurge });
        if (!dueForPurge) pollsSincePurge += 1;
        if (processed + failed < BATCH_SIZE) break;
      }
    } catch (error) {
      console.error(
        `[jobs] worker tick failed: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      ticking = false;
    }
  };

  const timer = setInterval(() => void tick(), IDLE_POLL_MS);
  // Never a reason to keep the process alive on its own.
  timer.unref?.();

  return {
    stop: async () => {
      running = false;
      clearInterval(timer);
      // Let an in-flight batch finish so a deploy does not abandon claimed work.
      while (ticking) await new Promise((resolve) => setTimeout(resolve, 50));
    },
  };
}