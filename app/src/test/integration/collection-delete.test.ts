import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { db } from "../../db";
import { bookmarks } from "../../db/schema";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

/**
 * Regression tests for issue #22: deleting a collection orphaned its
 * bookmarks (collectionId = NULL → invisible in every listing, yet the
 * (userId, url) unique index still blocked re-adding the URL).
 *
 * Contract under test:
 * - default delete re-homes bookmarks to Unsorted (never NULL);
 * - ?deleteBookmarks=true destroys them;
 * - parents with children are blocked (409, nothing mutated);
 * - collectionId assignment is owner-validated.
 */
describe("collection delete — orphan fix (#22)", () => {
  let userId: string;
  let cookie: string;
  let unsortedId: string;
  let otherUserId: string;
  let otherCookie: string;
  let n = 0;
  const url = () => `https://example.com/del-${Date.now()}-${n++}`;

  const createCollection = async (name: string, parentId?: string, useCookie = cookie) => {
    const res = await app.handle(
      new Request("http://localhost/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: useCookie },
        body: JSON.stringify({ name, parentId }),
      }),
    );
    expect(res.status).toBe(200);
    return res.json() as Promise<{ id: string }>;
  };

  const createBookmark = async (u: string, collectionId?: string, useCookie = cookie) => {
    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: useCookie },
        body: JSON.stringify({ url: u, title: `T ${u}`, ...(collectionId ? { collectionId } : {}) }),
      }),
    );
    expect(res.status).toBe(200);
    return res.json() as Promise<{ id: string; collectionId: string | null }>;
  };

  const deleteCollection = (id: string, qs = "", useCookie = cookie) =>
    app.handle(
      new Request(`http://localhost/collections/${id}${qs}`, {
        method: "DELETE",
        headers: { Cookie: useCookie },
      }),
    );

  beforeAll(async () => {
    const testUser = await createTestUser();
    userId = testUser.user.id;
    cookie = await getSessionCookie(testUser.email, testUser.password);
    const other = await createTestUser();
    otherUserId = other.user.id;
    otherCookie = await getSessionCookie(other.email, other.password);

    const res = await app.handle(
      new Request("http://localhost/collections", { headers: { Cookie: cookie } }),
    );
    const colls = await res.json();
    unsortedId = colls.find((c: any) => c.slug === "unsorted")?.id;
    expect(unsortedId).toBeDefined();
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
    await cleanupTestUser(otherUserId);
  });

  test("delete moves bookmarks to Unsorted and they stay listed", async () => {
    const col = await createCollection("Doomed");
    const u = url();
    const bm = await createBookmark(u, col.id);

    const del = await deleteCollection(col.id);
    expect(del.status).toBe(200);
    const body = await del.json();
    expect(body.movedBookmarks).toBe(1);

    // Still listed in the default feed, re-homed to Unsorted.
    const list = await app.handle(
      new Request("http://localhost/bookmarks?limit=100", { headers: { Cookie: cookie } }),
    );
    const { data } = await list.json();
    const found = data.find((b: any) => b.id === bm.id);
    expect(found).toBeDefined();
    expect(found.collectionId).toBe(unsortedId);
  });

  test("same URL still 409s after delete, with a fetchable existingId", async () => {
    const col = await createCollection("Doomed 2");
    const u = url();
    await createBookmark(u, col.id);
    await deleteCollection(col.id);

    const dup = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ url: u, title: "Again" }),
      }),
    );
    expect(dup.status).toBe(409);
    const err = await dup.json();
    expect(typeof err.details.existingId).toBe("string");

    // Recovery path: the existing bookmark is directly fetchable.
    const get = await app.handle(
      new Request(`http://localhost/bookmarks/${err.details.existingId}`, {
        headers: { Cookie: cookie },
      }),
    );
    expect(get.status).toBe(200);
  });

  test("?deleteBookmarks=true destroys both, URL becomes reusable", async () => {
    const col = await createCollection("Doomed 3");
    const u = url();
    const bm = await createBookmark(u, col.id);

    const del = await deleteCollection(col.id, "?deleteBookmarks=true");
    expect(del.status).toBe(200);
    expect((await del.json()).deletedBookmarks).toBe(1);

    const get = await app.handle(
      new Request(`http://localhost/bookmarks/${bm.id}`, { headers: { Cookie: cookie } }),
    );
    expect(get.status).toBe(404);

    const recreate = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ url: u, title: "Reborn" }),
      }),
    );
    expect(recreate.status).toBe(200);
  });

  test("parent with children is blocked and nothing is mutated", async () => {
    const parent = await createCollection("Parent");
    const child = await createCollection("Child", parent.id);
    const u = url();
    await createBookmark(u, parent.id);

    const del = await deleteCollection(parent.id);
    expect(del.status).toBe(409);
    const err = await del.json();
    expect(err.details.childCount).toBe(1);

    // Parent, child link, and bookmark all untouched.
    const list = await app.handle(
      new Request("http://localhost/collections", { headers: { Cookie: cookie } }),
    );
    const all = await list.json();
    expect(all.find((c: any) => c.id === parent.id)).toBeDefined();
    expect(all.find((c: any) => c.id === child.id).parentId).toBe(parent.id);
    const feed = await app.handle(
      new Request("http://localhost/bookmarks?limit=100", { headers: { Cookie: cookie } }),
    );
    const { data } = await feed.json();
    expect(data.find((b: any) => b.url === u && b.collectionId === parent.id)).toBeDefined();
  });

  test("assigning a foreign collectionId is rejected", async () => {
    const victim = await createCollection("Victim", undefined, otherCookie);
    const u = url();
    const bm = await createBookmark(u);

    // Single create with foreign collection.
    const badCreate = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ url: url(), title: "X", collectionId: victim.id }),
      }),
    );
    expect(badCreate.status).toBe(404);

    // Single update with foreign collection.
    const badPatch = await app.handle(
      new Request(`http://localhost/bookmarks/${bm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ collectionId: victim.id }),
      }),
    );
    expect(badPatch.status).toBe(404);
  });

  test("legacy NULL-collectionId orphans stay visible (NULL-safe filter)", async () => {
    const u = url();
    const [orphan] = await db
      .insert(bookmarks)
      .values({ userId, url: u, title: "Legacy orphan", domain: "example.com", collectionId: null })
      .returning({ id: bookmarks.id });

    const list = await app.handle(
      new Request("http://localhost/bookmarks?limit=100", { headers: { Cookie: cookie } }),
    );
    const { data } = await list.json();
    expect(data.find((b: any) => b.id === orphan.id)).toBeDefined();

    // And it can be re-homed through the normal update path.
    const move = await app.handle(
      new Request(`http://localhost/bookmarks/${orphan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ collectionId: unsortedId }),
      }),
    );
    expect(move.status).toBe(200);
  });
});
