import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

describe("archive via archived_at (phase 2 §3.2)", () => {
  let userId: string;
  let cookie: string;
  let collectionId: string;

  const createCollection = async (name: string) => {
    const res = await app.handle(
      new Request("http://localhost/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name }),
      }),
    );
    return (await res.json()) as { id: string };
  };

  const createBookmark = async (url: string, collectionId?: string) => {
    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          url,
          title: url,
          ...(collectionId ? { collectionIds: [collectionId] } : {}),
        }),
      }),
    );
    return (await res.json()) as {
      id: string;
      collectionIds: string[];
      archivedAt: string | null;
    };
  };

  const getBookmark = async (id: string) => {
    const res = await app.handle(
      new Request(`http://localhost/bookmarks/${id}`, {
        headers: { Cookie: cookie },
      }),
    );
    return (await res.json()) as {
      id: string;
      collectionIds: string[];
      archivedAt: string | null;
    };
  };

  const archive = (id: string) =>
    app.handle(
      new Request(`http://localhost/bookmarks/${id}/archive`, {
        method: "POST",
        headers: { Cookie: cookie },
      }),
    );

  beforeAll(async () => {
    const testUser = await createTestUser();
    userId = testUser.user.id;
    cookie = await getSessionCookie(testUser.email, testUser.password);
    collectionId = (await createCollection("Keep me")).id;
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
  });

  test("archiving keeps the bookmark's collection", async () => {
    const bookmark = await createBookmark(
      "https://example.com/keep",
      collectionId,
    );
    expect(bookmark.collectionIds).toEqual([collectionId]);

    expect((await archive(bookmark.id)).status).toBe(200);

    const archived = await getBookmark(bookmark.id);
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.collectionIds).toEqual([collectionId]);
  });

  test("archived bookmarks are hidden by default and listed under ?archived=true", async () => {
    const bookmark = await createBookmark(
      "https://example.com/hidden",
      collectionId,
    );
    await archive(bookmark.id);

    const def = await app.handle(
      new Request("http://localhost/bookmarks?limit=100", {
        headers: { Cookie: cookie },
      }),
    );
    const defData = await def.json();
    expect(defData.data.some((b: { id: string }) => b.id === bookmark.id)).toBe(
      false,
    );

    const archived = await app.handle(
      new Request("http://localhost/bookmarks?archived=true&limit=100", {
        headers: { Cookie: cookie },
      }),
    );
    const archData = await archived.json();
    expect(
      archData.data.every((b: { archivedAt: string | null }) => b.archivedAt !== null),
    ).toBe(true);
    expect(
      archData.data.some((b: { id: string }) => b.id === bookmark.id),
    ).toBe(true);
  });

  test("unarchiving keeps the collection", async () => {
    const bookmark = await createBookmark(
      "https://example.com/restore",
      collectionId,
    );
    await archive(bookmark.id);
    await app.handle(
      new Request(`http://localhost/bookmarks/${bookmark.id}/unarchive`, {
        method: "POST",
        headers: { Cookie: cookie },
      }),
    );

    const restored = await getBookmark(bookmark.id);
    expect(restored.archivedAt).toBeNull();
    expect(restored.collectionIds).toEqual([collectionId]);
  });

  test("delete requires archiving first", async () => {
    const bookmark = await createBookmark(
      "https://example.com/del",
      collectionId,
    );
    const early = await app.handle(
      new Request(`http://localhost/bookmarks/${bookmark.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      }),
    );
    expect(early.status).toBe(409);

    await archive(bookmark.id);
    const ok = await app.handle(
      new Request(`http://localhost/bookmarks/${bookmark.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      }),
    );
    expect(ok.status).toBe(200);
  });

  test("bulk archive, delete and unarchive honour archived_at", async () => {
    const a = await createBookmark("https://example.com/bulk-a", collectionId);
    const b = await createBookmark("https://example.com/bulk-b", collectionId);

    const archived = await app.handle(
      new Request("http://localhost/bookmarks/bulk/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ ids: [a.id, b.id] }),
      }),
    );
    expect((await archived.json()).archived).toBe(2);

    const del = await app.handle(
      new Request("http://localhost/bookmarks/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ ids: [a.id] }),
      }),
    );
    expect((await del.json()).deleted).toBe(1);

    const restored = await app.handle(
      new Request("http://localhost/bookmarks/bulk/unarchive", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ ids: [b.id] }),
      }),
    );
    expect((await restored.json()).unarchived).toBe(1);
  });
});
