import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { resetRateLimits } from "../../utils/rate-limit";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

describe("public share api", () => {
  let userId: string;
  let cookie: string;
  let parentId: string;
  let childId: string;
  let shareCode: string;

  const createCollection = async (body: Record<string, unknown>) => {
    const res = await app.handle(
      new Request("http://localhost/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(body),
      }),
    );
    return (await res.json()) as { id: string };
  };

  beforeAll(async () => {
    const testUser = await createTestUser();
    userId = testUser.user.id;
    cookie = await getSessionCookie(testUser.email, testUser.password);

    parentId = (await createCollection({ name: "Design" })).id;
    childId = (await createCollection({ name: "Type", parentId })).id;

    await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          url: "https://example.com/nested",
          title: "Nested Bookmark",
          collectionIds: [childId],
          note: "private note",
          isFavorite: true,
        }),
      }),
    );

    const share = await app.handle(
      new Request(`http://localhost/collections/${parentId}/share`, {
        method: "POST",
        headers: { Cookie: cookie },
      }),
    );
    shareCode = (await share.json()).shareCode;
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
  });

  test("serves the whole subtree to an anonymous reader", async () => {
    const res = await app.handle(
      new Request(`http://localhost/share/${shareCode}`),
    );

    expect(res.status).toBe(200);
    const data = await res.json();

    // Recursive CTE: the nested collection and its bookmark are both reachable.
    expect(data.nestedCollections.map((c: { name: string }) => c.name)).toContain("Type");
    expect(
      data.bookmarks.data.map((b: { title: string }) => b.title),
    ).toContain("Nested Bookmark");
    expect(data.bookmarks.pagination.total).toBe(1);
  });

  test("never exposes note or isFavorite to anonymous readers", async () => {
    const res = await app.handle(
      new Request(`http://localhost/share/${shareCode}`),
    );
    const data = await res.json();

    for (const bookmark of data.bookmarks.data) {
      expect(bookmark).not.toHaveProperty("note");
      expect(bookmark).not.toHaveProperty("isFavorite");
    }
  });

  test("answers 410 once the share is revoked", async () => {
    const revoke = await app.handle(
      new Request(`http://localhost/collections/${parentId}/share`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      }),
    );
    expect(revoke.status).toBe(200);

    const res = await app.handle(
      new Request(`http://localhost/share/${shareCode}`),
    );
    expect(res.status).toBe(410);
  });

  test("rate limits the public directory with 429 + Retry-After", async () => {
    resetRateLimits();

    let limited: Response | undefined;
    for (let i = 0; i < 65; i++) {
      const res = await app.handle(
        new Request("http://localhost/share/explore?limit=24"),
      );
      if (res.status === 429) {
        limited = res;
        break;
      }
    }

    expect(limited).toBeDefined();
    expect(Number(limited!.headers.get("retry-after"))).toBeGreaterThan(0);
    const body = await limited!.json();
    expect(body.error).toContain("Too many requests");

    resetRateLimits();
  });
});

describe("GET /user/stats", () => {
  let userId: string;
  let cookie: string;

  beforeAll(async () => {
    const testUser = await createTestUser();
    userId = testUser.user.id;
    cookie = await getSessionCookie(testUser.email, testUser.password);
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
  });

  test("counts collections and tags even for a user with no bookmarks", async () => {
    const res = await app.handle(
      new Request("http://localhost/user/stats", { headers: { Cookie: cookie } }),
    );

    expect(res.status).toBe(200);
    const stats = await res.json();
    // Signup provisions Unsorted only ("Archived" is a bookmark flag now).
    expect(stats.collections).toBe(1);
    expect(stats.bookmarks).toBe(0);
    expect(stats.tags).toBe(0);
  });

  test("does not multiply counts across bookmarks", async () => {
    for (const title of ["one", "two", "three"]) {
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ url: `https://example.com/${title}`, title }),
        }),
      );
    }

    const res = await app.handle(
      new Request("http://localhost/user/stats", { headers: { Cookie: cookie } }),
    );
    const stats = await res.json();

    expect(stats.bookmarks).toBe(3);
    expect(stats.collections).toBe(1);
  });
});