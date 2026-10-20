import { describe, test, expect, afterEach, beforeEach, mock, spyOn } from "bun:test";
import { sql } from "drizzle-orm";
import { app } from "../../index";
import { db } from "../../db";
import { setHostResolver, resetHostResolver } from "../../utils/url-guard";
import { registerJobHandlers, runOnce } from "../../utils/jobs";
import { enrichMetadata } from "../../utils/enrichment";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

// The worker does not start under NODE_ENV=test (see src/index.ts), so the
// queue is driven one tick at a time. That is strictly better than the polling
// and `setTimeout` sleeps this file used to need against the old in-process
// fire-and-forget path: enrichment now happens at a point we choose.
registerJobHandlers({ "enrich-metadata": enrichMetadata });

/**
 * Start each test with an empty queue.
 *
 * These tests assert exact `processed`/`failed` counts, and `runOnce()` claims
 * whatever is due — including rows other files left behind when they saved a
 * bookmark and never drained the queue. Clearing it is the same isolation
 * `jobs.test.ts` uses, for the same reason.
 */
beforeEach(async () => {
  await db.execute(sql`DELETE FROM "jobs"`);
});

async function getBookmark(id: string, cookie: string) {
  return await (
    await app.handle(
      new Request(`http://localhost/bookmarks/${id}`, { headers: { Cookie: cookie } }),
    )
  ).json();
}

describe("POST /bookmarks metadata enrichment", () => {
  afterEach(() => {
    mock.restore();
    resetHostResolver();
  });

  test("returns immediately and fills the title in afterwards", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    setHostResolver(async () => ["93.184.216.34"]);
    let fetches = 0;
    spyOn(global, "fetch").mockImplementation((async () => {
      fetches++;
      return new Response(
        `<html><head><title>Enriched Page</title>
         <meta property="og:description" content="scraped description">
         <meta property="og:image" content="https://example.com/cover.jpg">
         </head></html>`,
      );
    }) as unknown as typeof fetch);

    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ url: "https://example.com/enrich-me" }),
      }),
    );

    expect(res.status).toBe(200);
    const created = await res.json();
    // The response is not blocked on the scrape: the hostname is the placeholder.
    expect(created.title).toBe("example.com");
    expect(fetches).toBe(0);

    const result = await runOnce();
    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(fetches).toBe(1);

    const detail = await getBookmark(created.id, cookie);
    expect(detail.title).toBe("Enriched Page");
    expect(detail.description).toBe("scraped description");
    expect(detail.cover).toBe("https://example.com/cover.jpg");

    await cleanupTestUser(testUser.user.id);
  });

  test("does not overwrite a title the user edited while the job was queued", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    setHostResolver(async () => ["93.184.216.34"]);
    spyOn(global, "fetch").mockImplementation((async () =>
      new Response(`<html><head><title>Scraped Title</title></head></html>`)) as unknown as typeof fetch);

    const created = await (
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ url: "https://example.com/raced-edit" }),
        }),
      )
    ).json();

    // The user edits while the job sits in the queue — the race the placeholder
    // guard exists for, and the reason the guard moved with the payload.
    const patched = await app.handle(
      new Request(`http://localhost/bookmarks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ title: "My Own Title" }),
      }),
    );
    expect(patched.status).toBe(200);

    await runOnce();

    const detail = await getBookmark(created.id, cookie);
    expect(detail.title).toBe("My Own Title");

    await cleanupTestUser(testUser.user.id);
  });

  test("keeps the hostname title when the URL is internal", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    setHostResolver(async () => ["10.0.0.5"]);
    const fetchSpy = spyOn(global, "fetch");

    const created = await (
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ url: "http://internal.svc/bookmarks" }),
        }),
      )
    ).json();

    await runOnce();

    // The SSRF guard refuses before any socket is opened, and the scrape falls
    // back to the hostname — a dead URL is a success here, not a retry.
    expect(fetchSpy).not.toHaveBeenCalled();
    const detail = await getBookmark(created.id, cookie);
    expect(detail.title).toBe("internal.svc");

    await cleanupTestUser(testUser.user.id);
  });

  test("a user-supplied title and cover survive enrichment", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    setHostResolver(async () => ["93.184.216.34"]);
    spyOn(global, "fetch").mockImplementation((async () =>
      new Response(
        `<html><head><title>Scraped Title</title>
         <meta property="og:description" content="scraped description">
         <meta property="og:image" content="https://example.com/scraped.jpg">
         </head></html>`,
      )) as unknown as typeof fetch);

    const created = await (
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({
            url: "https://example.com/kept",
            title: "My Title",
            description: "My Description",
            cover: "https://example.com/mine.jpg",
          }),
        }),
      )
    ).json();

    await runOnce();

    const detail = await getBookmark(created.id, cookie);
    // `keep` travels in the payload, so the user's values still win after the
    // job waited in the queue — this is why it is not re-read at claim time.
    expect(detail.title).toBe("My Title");
    expect(detail.description).toBe("My Description");
    expect(detail.cover).toBe("https://example.com/mine.jpg");

    await cleanupTestUser(testUser.user.id);
  });

  test("a hand-titled bookmark still gets a cover", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    setHostResolver(async () => ["93.184.216.34"]);
    spyOn(global, "fetch").mockImplementation((async () =>
      new Response(
        `<html><head><title>Scraped Title</title>
         <meta property="og:description" content="scraped description">
         <meta property="og:image" content="https://example.com/scraped.jpg">
         </head></html>`,
      )) as unknown as typeof fetch);

    const created = await (
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({
            url: "https://example.com/hand-titled",
            title: "My Title",
          }),
        }),
      )
    ).json();

    const result = await runOnce();
    // The old gate was `if (!body.title)`, so a titled bookmark never queued a
    // job at all and could never gain a cover. It now runs and fills only the
    // fields the user left empty.
    expect(result).toEqual({ processed: 1, failed: 0 });

    const detail = await getBookmark(created.id, cookie);
    expect(detail.title).toBe("My Title");
    expect(detail.description).toBe("scraped description");
    expect(detail.cover).toBe("https://example.com/scraped.jpg");

    await cleanupTestUser(testUser.user.id);
  });

  test("a transient fetch failure fails the job so the queue retries it", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    setHostResolver(async () => ["93.184.216.34"]);
    // The scrape layer now distinguishes "the server was briefly down" from
    // "this page has no metadata": the former must fail the job, not write the
    // hostname and quietly drop the cover forever.
    spyOn(global, "fetch").mockRejectedValue(new Error("socket hang up"));

    const created = await (
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ url: "https://example.com/flaky" }),
        }),
      )
    ).json();

    expect(await runOnce()).toEqual({ processed: 0, failed: 1 });

    const detail = await getBookmark(created.id, cookie);
    expect(detail.title).toBe("example.com");

    await cleanupTestUser(testUser.user.id);
  });
});