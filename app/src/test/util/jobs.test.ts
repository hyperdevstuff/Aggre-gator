/**
 * Queue mechanics: claiming, retry/backoff, exhaustion and crash recovery.
 *
 * These are the properties that make the queue worth more than the
 * `setTimeout` it replaced, so each one is asserted directly against the table
 * rather than inferred from a route's behaviour.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";
import { enqueue, registerJobHandlers, runOnce } from "../../utils/jobs";

/** Jobs this file enqueued, so cleanup cannot touch another test's rows. */
let owned: string[] = [];

async function enqueueTracked(
  type: "enrich-metadata" | "probe",
  payload: Record<string, unknown> = {},
  options: { maxAttempts?: number } = {},
) {
  const id = await enqueue(type as "enrich-metadata", payload as never, options);
  owned.push(id);
  return id;
}

async function rowFor(id: string) {
  const [row] = await db.select().from(jobs).where(sql`${jobs.id} = ${id}`);
  return row;
}

/** Force a job to be due now, so a test never waits out real backoff. */
async function makeDue(id: string) {
  await db.execute(sql`UPDATE "jobs" SET "run_at" = now() - interval '1 second' WHERE "id" = ${id}`);
}

/**
 * Drain the queue before each test.
 *
 * `runOnce()` claims whatever is due, so a job left pending by another file (or
 * by a previous failed run) would be picked up here and counted in *this* test's
 * totals. Clearing the table is the honest isolation: these tests are asserting
 * exact processed/failed counts, which a shared queue cannot promise.
 */
beforeEach(async () => {
  owned = [];
  await db.execute(sql`DELETE FROM "jobs"`);
  // `probe` is a controllable handler for the mechanics below.
  registerJobHandlers({
    "enrich-metadata": async () => {},
    probe: async () => {},
  } as never);
});

afterEach(async () => {
  if (owned.length === 0) return;
  await db.delete(jobs).where(inArray(jobs.id, owned));
  owned = [];
});

describe("enqueue", () => {
  test("writes a pending job that is immediately due", async () => {
    const id = await enqueueTracked("probe");
    const row = await rowFor(id);

    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(0);
    expect(row.payload).toEqual({});
    expect(row.runAt.getTime()).toBeLessThanOrEqual(Date.now() + 1_000);
  });

  test("carries the payload the handler needs", async () => {
    const id = await enqueueTracked("enrich-metadata", {
      bookmarkId: "b-1",
      url: "https://example.com",
      placeholderTitle: "example.com",
      keep: { description: null, cover: null },
    });
    const row = await rowFor(id);

    expect(row.type).toBe("enrich-metadata");
    expect(row.payload.bookmarkId).toBe("b-1");
    expect(row.payload.keep).toEqual({ description: null, cover: null });
  });
});

describe("runOnce", () => {
  test("claims a pending job, runs it, and marks it completed", async () => {
    let ran = 0;
    registerJobHandlers({ probe: async () => { ran++; } } as never);

    const id = await enqueueTracked("probe");
    const result = await runOnce();

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(ran).toBe(1);

    const row = await rowFor(id);
    expect(row.status).toBe("completed");
    expect(row.attempts).toBe(1);
    expect(row.lockedAt).toBeNull();
    expect(row.lastError).toBeNull();
  });

  test("does not run the same job twice", async () => {
    let ran = 0;
    registerJobHandlers({ probe: async () => { ran++; } } as never);

    await enqueueTracked("probe");

    await runOnce();
    // A completed job is no longer claimable, which is what stops the polling
    // loop from re-running work it has already done.
    const second = await runOnce();

    expect(second).toEqual({ processed: 0, failed: 0 });
    expect(ran).toBe(1);
  });

  test("leaves a future-dated job alone", async () => {
    let ran = 0;
    registerJobHandlers({ probe: async () => { ran++; } } as never);

    const id = await enqueueTracked("probe");
    await db.execute(sql`UPDATE "jobs" SET "run_at" = now() + interval '1 hour' WHERE "id" = ${id}`);

    expect(await runOnce()).toEqual({ processed: 0, failed: 0 });
    expect(ran).toBe(0);
    expect((await rowFor(id)).status).toBe("pending");
  });

  test("treats a missing handler as a failure rather than dropping the job", async () => {
    // No `probe` handler registered at all.
    registerJobHandlers({ "enrich-metadata": async () => {} } as never);

    const id = await enqueueTracked("probe", {}, { maxAttempts: 1 });
    const result = await runOnce();

    expect(result.failed).toBe(1);
    const row = await rowFor(id);
    // Buried, with the reason kept — an unknown job type is an operator
    // problem, and silently deleting the row would hide it.
    expect(row.status).toBe("failed");
    expect(row.lastError).toContain("no handler registered");
  });
});

describe("retry and backoff", () => {
  test("reschedules a failed job in the future instead of immediately re-running it", async () => {
    registerJobHandlers({ probe: async () => { throw new Error("boom"); } } as never);

    const id = await enqueueTracked("probe");
    expect(await runOnce()).toEqual({ processed: 0, failed: 1 });

    const row = await rowFor(id);
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe("boom");
    // Backoff is a column, not a sleep — so a failing job costs a row and no
    // open timer, and a restart resumes the schedule rather than resetting it.
    expect(row.runAt.getTime()).toBeGreaterThan(Date.now());

    // And it is genuinely not due yet.
    expect(await runOnce()).toEqual({ processed: 0, failed: 0 });
  });

  test("grows the delay with each attempt", async () => {
    registerJobHandlers({ probe: async () => { throw new Error("boom"); } } as never);

    const id = await enqueueTracked("probe", {}, { maxAttempts: 5 });

    await runOnce();
    const firstDelay = (await rowFor(id)).runAt.getTime() - Date.now();
    await makeDue(id);
    await runOnce();
    const secondDelay = (await rowFor(id)).runAt.getTime() - Date.now();

    expect(secondDelay).toBeGreaterThan(firstDelay);
  });

  test("succeeds after a transient failure", async () => {
    let calls = 0;
    registerJobHandlers({
      probe: async () => {
        calls++;
        if (calls === 1) throw new Error("transient");
      },
    } as never);

    const id = await enqueueTracked("probe");

    expect(await runOnce()).toEqual({ processed: 0, failed: 1 });
    await makeDue(id);
    expect(await runOnce()).toEqual({ processed: 1, failed: 0 });
    expect(calls).toBe(2);

    const row = await rowFor(id);
    expect(row.status).toBe("completed");
    // A job that eventually succeeds is not left carrying its old error.
    expect(row.lastError).toBeNull();
  });

  test("buries a job once attempts are exhausted", async () => {
    registerJobHandlers({ probe: async () => { throw new Error("always fails"); } } as never);

    const id = await enqueueTracked("probe", {}, { maxAttempts: 2 });

    await runOnce();
    await makeDue(id);
    await runOnce();

    const row = await rowFor(id);
    expect(row.attempts).toBe(2);
    expect(row.status).toBe("failed");

    // Exhausted means exhausted: it must not be picked up again.
    await makeDue(id);
    expect(await runOnce()).toEqual({ processed: 0, failed: 0 });
    expect((await rowFor(id)).attempts).toBe(2);
  });

  test("truncates a very long error message", async () => {
    registerJobHandlers({ probe: async () => { throw new Error("x".repeat(5_000)); } } as never);

    const id = await enqueueTracked("probe", {}, { maxAttempts: 1 });
    await runOnce();

    expect(((await rowFor(id)).lastError ?? "").length).toBe(1_000);
  });
});

describe("retention", () => {
  test("keeps a recently settled job", async () => {
    registerJobHandlers({ probe: async () => {} } as never);

    const id = await enqueueTracked("probe");
    await runOnce({ purge: true });

    expect((await rowFor(id)).status).toBe("completed");
  });

  test("deletes a settled job past the retention window", async () => {
    registerJobHandlers({ probe: async () => {} } as never);

    const id = await enqueueTracked("probe");
    await runOnce();
    // Backdate past the 24h window; without a sweep this row would sit forever,
    // one per bookmark save.
    await db.execute(sql`UPDATE "jobs" SET "updated_at" = now() - interval '2 days' WHERE "id" = ${id}`);

    await runOnce({ purge: true });

    expect(await rowFor(id)).toBeUndefined();
  });

  test("deletes a long-failed job too", async () => {
    registerJobHandlers({ probe: async () => { throw new Error("boom"); } } as never);

    const id = await enqueueTracked("probe", {}, { maxAttempts: 1 });
    await runOnce();
    expect((await rowFor(id)).status).toBe("failed");

    await db.execute(sql`UPDATE "jobs" SET "updated_at" = now() - interval '2 days' WHERE "id" = ${id}`);
    await runOnce({ purge: true });

    // 24h is a debugging window, not permanent storage — once it closes the row
    // goes, so the table cannot grow unbounded.
    expect(await rowFor(id)).toBeUndefined();
  });

  test("never purges a job that has not settled", async () => {
    registerJobHandlers({ probe: async () => {} } as never);

    const id = await enqueueTracked("probe", {}, { maxAttempts: 5 });
    await db.execute(sql`
      UPDATE "jobs"
      SET "status" = 'active', "locked_at" = now(), "updated_at" = now() - interval '2 days'
      WHERE "id" = ${id}
    `);

    await runOnce({ purge: true });

    // An in-flight job must survive a sweep regardless of age; the lease reaper
    // is what decides its fate.
    expect((await rowFor(id))?.status).toBe("active");
  });
});

describe("crash recovery", () => {
  test("reclaims a job whose worker died mid-flight", async () => {
    let ran = 0;
    registerJobHandlers({ probe: async () => { ran++; } } as never);

    const id = await enqueueTracked("probe");

    // Simulate a worker that claimed the row and was killed before finishing:
    // status stuck at `active`, lease in the past.
    await db.execute(sql`
      UPDATE "jobs"
      SET "status" = 'active', "locked_at" = now() - interval '5 minutes', "attempts" = 1
      WHERE "id" = ${id}
    `);

    expect(await runOnce()).toEqual({ processed: 1, failed: 0 });
    expect(ran).toBe(1);

    const row = await rowFor(id);
    expect(row.status).toBe("completed");
    // The attempt is charged against the dead worker, so a job that reliably
    // kills its worker still runs out of attempts instead of looping forever.
    expect(row.attempts).toBe(2);
  });

  test("leaves a live lease alone", async () => {
    let ran = 0;
    registerJobHandlers({ probe: async () => { ran++; } } as never);

    const id = await enqueueTracked("probe");
    await db.execute(sql`
      UPDATE "jobs" SET "status" = 'active', "locked_at" = now() WHERE "id" = ${id}
    `);

    // Another worker still holds this one; reaping it now would run the job
    // twice in parallel.
    expect(await runOnce()).toEqual({ processed: 0, failed: 0 });
    expect(ran).toBe(0);
    expect((await rowFor(id)).status).toBe("active");
  });
});

describe("claim concurrency", () => {
  test("two workers never claim the same job", async () => {
    const id = await enqueueTracked("probe");

    // The SKIP LOCKED claim, run twice without releasing in between. In a single
    // connection the first UPDATE has already committed by the time the second
    // runs, so this asserts the row is claim-exactly-once rather than
    // exercising a true cross-connection race.
    const first = await db.execute(sql`
      UPDATE "jobs" SET "status" = 'active', "locked_at" = now()
      WHERE "id" IN (
        SELECT "id" FROM "jobs" WHERE "status" = 'pending' AND "run_at" <= now()
        ORDER BY "run_at" FOR UPDATE SKIP LOCKED
      ) RETURNING "id"
    `);
    const second = await db.execute(sql`
      UPDATE "jobs" SET "status" = 'active', "locked_at" = now()
      WHERE "id" IN (
        SELECT "id" FROM "jobs" WHERE "status" = 'pending' AND "run_at" <= now()
        ORDER BY "run_at" FOR UPDATE SKIP LOCKED
      ) RETURNING "id"
    `);

    const claimed = (first.rows ?? []).map((r) => (r as { id: string }).id);
    expect(claimed).toContain(id);
    expect((second.rows ?? []).map((r) => (r as { id: string }).id)).not.toContain(id);
  });
});