import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

describe("GET /collections/:id/analytics", () => {
  let userId: string;
  let cookie: string;
  let collectionId: string;
  let shareCode: string;

  beforeAll(async () => {
    const testUser = await createTestUser();
    userId = testUser.user.id;
    cookie = await getSessionCookie(testUser.email, testUser.password);

    const colRes = await app.handle(
      new Request("http://localhost/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Analytics Col" }),
      }),
    );
    collectionId = (await colRes.json()).id;

    await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          url: "https://example.com/top",
          title: "Top Bookmark",
          collectionIds: [collectionId],
        }),
      }),
    );

    const share = await app.handle(
      new Request(`http://localhost/collections/${collectionId}/share`, {
        method: "POST",
        headers: { Cookie: cookie },
      }),
    );
    shareCode = (await share.json()).shareCode;

    // Generate a view via the share link (with a referrer).
    await app.handle(
      new Request(`http://localhost/share/${shareCode}`, {
        headers: { Referer: "https://referrer.example.com/path" },
      }),
    );
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
  });

  test("owner gets analytics with the expected shape", async () => {
    const res = await app.handle(
      new Request(`http://localhost/collections/${collectionId}/analytics`, {
        headers: { Cookie: cookie },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("totalViews");
    expect(data).toHaveProperty("viewsPerDay");
    expect(data).toHaveProperty("referrerBreakdown");
    expect(data).toHaveProperty("topBookmarks");
    expect(Array.isArray(data.viewsPerDay)).toBe(true);
    expect(data.viewsPerDay.length).toBe(30);
    expect(data.referrerBreakdown).toEqual([
      { referrer: "https://referrer.example.com", count: 1 },
    ]);
    expect(data.topBookmarks.length).toBe(1);
    expect(data.topBookmarks[0].title).toBe("Top Bookmark");
  });

  test("non-owner gets 404", async () => {
    const other = await createTestUser();
    const otherCookie = await getSessionCookie(other.email, other.password);
    const res = await app.handle(
      new Request(`http://localhost/collections/${collectionId}/analytics`, {
        headers: { Cookie: otherCookie },
      }),
    );
    expect(res.status).toBe(404);
    await cleanupTestUser(other.user.id);
  });

  test("unauthenticated gets 401/403", async () => {
    const res = await app.handle(
      new Request(`http://localhost/collections/${collectionId}/analytics`),
    );
    expect([401, 403]).toContain(res.status);
  });
});