import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { createTestUser, getAuthToken, cleanupTestUser } from "./setup";

describe("bookmarks api", () => {
  let userId: string;
  let token: string;
  let unsortedId: string;

  beforeAll(async () => {
    const testUser = await createTestUser();
    userId = testUser.user.id;
    token = await getAuthToken(testUser.email, testUser.password);

    const res = await app.handle(
      new Request("http://localhost/collections", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const colls = await res.json();
    unsortedId = colls.find((c: any) => c.slug === "unsorted")?.id;
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
  });

  test("POST /bookmarks creates bookmark", async () => {
    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: "https://example.com/test",
          title: "Test Bookmark",
          isFavorite: false,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://example.com/test");
    expect(data.title).toBe("Test Bookmark");
    expect(data.collectionId).toBe(unsortedId);
  });

  test("POST /bookmarks rejects duplicate url", async () => {
    // create first
    await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: "https://example.com/dup",
          title: "First",
        }),
      }),
    );

    // try duplicate
    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: "https://example.com/dup",
          title: "Duplicate",
        }),
      }),
    );

    expect(res.status).toBe(409);
    const err = await res.json();
    expect(err.error).toContain("already exists");
  });

  test("GET /bookmarks returns paginated results", async () => {
    // create 25 bookmarks
    for (let i = 0; i < 25; i++) {
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            url: `https://example.com/page-${i}`,
            title: `Page ${i}`,
          }),
        }),
      );
    }

    // get page 1
    const res = await app.handle(
      new Request("http://localhost/bookmarks?page=1&limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const { data, pagination } = await res.json();
    expect(data.length).toBe(20);
    expect(pagination.page).toBe(1);
    expect(pagination.totalPages).toBe(2);
    expect(pagination.hasNext).toBe(true);
  });

  test("GET /bookmarks filters by collection", async () => {
    const res = await app.handle(
      new Request(`http://localhost/bookmarks?collectionId=${unsortedId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const { data } = await res.json();
    expect(data.every((b: any) => b.collectionId === unsortedId)).toBe(true);
  });

  test("PATCH /bookmarks/:id updates bookmark", async () => {
    // create
    const create = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: "https://example.com/update",
          title: "Original",
        }),
      }),
    );
    const bookmark = await create.json();

    // update
    const res = await app.handle(
      new Request(`http://localhost/bookmarks/${bookmark.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Updated",
          isFavorite: true,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.title).toBe("Updated");
    expect(updated.isFavorite).toBe(true);
  });

  test("DELETE /bookmarks/:id requires archive first", async () => {
    const create = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: "https://example.com/delete",
          title: "To Delete",
        }),
      }),
    );
    const bookmark = await create.json();

    // try delete without archive
    const res = await app.handle(
      new Request(`http://localhost/bookmarks/${bookmark.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(409);
  });

  test("POST /bookmarks without auth returns 401", async () => {
    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/noauth",
          title: "No Auth",
        }),
      }),
    );

    expect(res.status).toBe(401);
  });
});
