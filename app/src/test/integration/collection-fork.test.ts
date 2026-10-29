import { describe, test, expect, afterEach } from "bun:test";
import { app } from "../../index";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

describe("POST /collections/:id/fork", () => {
  afterEach(async () => {
    // Clean up any leftover collections from failed tests.
    await db.execute(sql`DELETE FROM "collection_items"`);
    await db.execute(sql`DELETE FROM "bookmarks" WHERE "link_id" IS NOT NULL`);
    await db.execute(sql`DELETE FROM "links"`);
  });

  test("forks a collection with its bookmarks and positions", async () => {
    // Owner creates a collection with two bookmarks.
    const owner = await createTestUser();
    const ownerCookie = await getSessionCookie(owner.email, owner.password);

    const colRes = await app.handle(
      new Request("http://localhost/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: ownerCookie },
        body: JSON.stringify({ name: "Original", icon: "📁", color: "#ff0000", visibility: "unlisted" }),
      }),
    );
    const col = await colRes.json();

    await (
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: ownerCookie },
          body: JSON.stringify({ url: "https://example.com/one", title: "One", collectionIds: [col.id] }),
        }),
      )
    ).json();
    const b2 = await (
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: ownerCookie },
          body: JSON.stringify({ url: "https://example.com/two", title: "Two", collectionIds: [col.id] }),
        }),
      )
    ).json();

    // Set a note on the second bookmark's collection_item.
    await db.execute(
      sql`UPDATE "collection_items" SET "note" = 'important', "position" = 1 WHERE "collection_id" = ${col.id} AND "bookmark_id" = ${b2.id}`,
    );

    // Forker copies it.
    const forker = await createTestUser();
    const forkerCookie = await getSessionCookie(forker.email, forker.password);

    const forkRes = await app.handle(
      new Request(`http://localhost/collections/${col.id}/fork`, {
        method: "POST",
        headers: { Cookie: forkerCookie },
      }),
    );
    expect(forkRes.status).toBe(200);
    const forked = await forkRes.json();

    expect(forked.name).toBe("Original (fork)");
    expect(forked.userId).toBe(forker.user.id);
    expect(forked.visibility).toBe("private");
    expect(forked.id).not.toBe(col.id);

    // Check the forked collection has the same bookmarks with positions.
    const itemsRes = await app.handle(
      new Request(`http://localhost/collections/${forked.id}/bookmarks`, {
        headers: { Cookie: forkerCookie },
      }),
    );
    const items = await itemsRes.json();
    const data = items.data ?? items;
    expect(data.length).toBe(2);

    const titles = data.map((b: any) => b.title).sort();
    expect(titles).toEqual(["One", "Two"]);

    // Positions and notes live on collection_items, not bookmarks — verify them
    // directly, since the GET endpoint returns bookmark rows.
    const ci = await db.execute(
      sql`SELECT position, note FROM collection_items WHERE collection_id = ${forked.id} ORDER BY position`,
    );
    const positions = (ci.rows as any[]).map((r) => r.position);
    const notes = (ci.rows as any[]).map((r) => r.note);
    expect(positions).toEqual([0, 1]);
    expect(notes).toContain("important");

    await cleanupTestUser(owner.user.id);
    await cleanupTestUser(forker.user.id);
  });

  test("forking a private collection you don't own returns 404", async () => {
    const owner = await createTestUser();
    const ownerCookie = await getSessionCookie(owner.email, owner.password);

    const colRes = await app.handle(
      new Request("http://localhost/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: ownerCookie },
        body: JSON.stringify({ name: "Private" }),
      }),
    );
    const col = await colRes.json();

    const forker = await createTestUser();
    const forkerCookie = await getSessionCookie(forker.email, forker.password);

    const forkRes = await app.handle(
      new Request(`http://localhost/collections/${col.id}/fork`, {
        method: "POST",
        headers: { Cookie: forkerCookie },
      }),
    );
    expect(forkRes.status).toBe(404);

    await cleanupTestUser(owner.user.id);
    await cleanupTestUser(forker.user.id);
  });

  test("forking a nonexistent collection returns 404", async () => {
    const user = await createTestUser();
    const cookie = await getSessionCookie(user.email, user.password);

    const forkRes = await app.handle(
      new Request("http://localhost/collections/does-not-exist/fork", {
        method: "POST",
        headers: { Cookie: cookie },
      }),
    );
    expect(forkRes.status).toBe(404);

    await cleanupTestUser(user.user.id);
  });
});