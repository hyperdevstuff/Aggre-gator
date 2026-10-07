import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { db } from "../../db";
import {
  bookmarks,
  collectionItems,
  collections,
  user as users,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

describe("collection_items (phase 2 data model)", () => {
  let userId: string;
  let cookie: string;
  let unsortedId: string;

  beforeAll(async () => {
    const testUser = await createTestUser();
    userId = testUser.user.id;
    cookie = await getSessionCookie(testUser.email, testUser.password);

    const res = await app.handle(
      new Request("http://localhost/collections", {
        headers: { Cookie: cookie },
      }),
    );
    const colls = await res.json();
    unsortedId = colls.find((c: { slug?: string }) => c.slug === "unsorted")?.id;
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
  });

  async function createBookmark(url: string, title: string) {
    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ url, title }),
      }),
    );
    return res.json();
  }

  async function createCollection(name: string) {
    const res = await app.handle(
      new Request("http://localhost/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name }),
      }),
    );
    return res.json() as Promise<{ id: string }>;
  }

  test("new bookmarks are filed into Unsorted by default", async () => {
    const bookmark = await createBookmark(
      "https://example.com/default-filed",
      "Default filed",
    );

    const rows = await db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.bookmarkId, bookmark.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].collectionId).toBe(unsortedId);
    expect(rows[0].position).toBe(0);
    expect(bookmark.collectionIds).toEqual([unsortedId]);
  });

  test("a bookmark can be filed into several collections", async () => {
    const bookmark = await createBookmark(
      "https://example.com/multi",
      "Multi",
    );
    const collection = await createCollection("Second home");

    const patched = await app.handle(
      new Request(`http://localhost/bookmarks/${bookmark.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ collectionIds: [unsortedId, collection.id] }),
      }),
    );
    expect(patched.status).toBe(200);
    const updated = await patched.json();
    expect(updated.collectionIds).toEqual([unsortedId, collection.id]);

    const res = await app.handle(
      new Request(`http://localhost/bookmarks/${bookmark.id}`, {
        headers: { Cookie: cookie },
      }),
    );
    const data = await res.json();
    expect(data.collectionIds).toContain(unsortedId);
    expect(data.collectionIds).toContain(collection.id);
  });

  test("(collection_id, bookmark_id) is unique", async () => {
    const bookmark = await createBookmark(
      "https://example.com/unique",
      "Unique",
    );
    // The create already filed it into Unsorted; a second identical row must
    // be rejected by the primary key.
    await expect(
      (async () => {
        await db
          .insert(collectionItems)
          .values({ collectionId: unsortedId, bookmarkId: bookmark.id });
      })(),
    ).rejects.toThrow();
  });

  test("memberships cascade when the bookmark is deleted", async () => {
    const bookmark = await createBookmark(
      "https://example.com/cascade",
      "Cascade",
    );
    await db.delete(bookmarks).where(eq(bookmarks.id, bookmark.id));

    const rows = await db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.bookmarkId, bookmark.id));
    expect(rows).toHaveLength(0);
  });

  test("new columns exist with their defaults", async () => {
    const [col] = await db
      .select({
        visibility: collections.visibility,
        publishedAt: collections.publishedAt,
      })
      .from(collections)
      .where(eq(collections.userId, userId))
      .limit(1);
    expect(col.visibility).toBe("private");
    expect(col.publishedAt).toBeNull();

    const [account] = await db
      .select({
        username: users.username,
        bio: users.bio,
        avatar: users.avatar,
        plan: users.plan,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    expect(account.username).toBeNull();
    expect(account.bio).toBeNull();
    expect(account.avatar).toBeNull();
    expect(account.plan).toBe("free");
  });
});
