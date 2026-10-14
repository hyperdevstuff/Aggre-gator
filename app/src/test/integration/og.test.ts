import { describe, test, expect, afterAll } from "bun:test";
import { app } from "../../index";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

/**
 * `/og/...` cards. Served from the API because the SPA catch-all would
 * otherwise return `index.html` with a `text/html` type, which every platform
 * rejects where a PNG was declared.
 */

const get = (path: string) => app.handle(new Request(`http://localhost${path}`));

async function json(path: string, cookie: string, init: RequestInit = {}) {
  const res = await app.handle(
    new Request(`http://localhost${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...(init.headers as Record<string, string> | undefined),
      },
    }),
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function expectPng(bytes: ArrayBuffer) {
  const buf = Buffer.from(bytes);
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  expect(view.getUint32(16)).toBe(1200);
  expect(view.getUint32(20)).toBe(630);
}

const userIds: string[] = [];

afterAll(async () => {
  for (const id of userIds) await cleanupTestUser(id);
});

describe("GET /og/collection/:id.png", () => {
  test("returns a 1200×630 PNG with cache headers", async () => {
    const testUser = await createTestUser();
    userIds.push(testUser.user.id);
    const cookie = await getSessionCookie(testUser.email, testUser.password);

    const col = (
      await json("/collections", cookie, {
        method: "POST",
        body: JSON.stringify({ name: "Card Test" }),
      })
    ).body;

    const res = await get(`/og/collection/${col.id}.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=86400, stale-while-revalidate=43200",
    );
    expectPng(await res.arrayBuffer());
  });

  test("works without a session", async () => {
    // No cookie: platforms fetch these anonymously.
    const testUser = await createTestUser();
    userIds.push(testUser.user.id);
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    const col = (
      await json("/collections", cookie, {
        method: "POST",
        body: JSON.stringify({ name: "Anon Card" }),
      })
    ).body;
    const res = await get(`/og/collection/${col.id}.png`);
    expect(res.status).toBe(200);
  });

  test("404s an unknown collection", async () => {
    const res = await get("/og/collection/00000000-0000-0000-0000-000000000000.png");
    expect(res.status).toBe(404);
  });
});

describe("GET /og/profile/:username.png", () => {
  test("returns a PNG for a known username, case-insensitively", async () => {
    const testUser = await createTestUser();
    userIds.push(testUser.user.id);
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    const username = `card_${Date.now().toString(36)}`;
    expect(
      (await json("/user/profile", cookie, {
        method: "PATCH",
        body: JSON.stringify({ username }),
      })).status,
    ).toBe(200);

    for (const variant of [username, username.toUpperCase()]) {
      const res = await get(`/og/profile/${variant}.png`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expectPng(await res.arrayBuffer());
    }
  });

  test("404s an unknown username", async () => {
    const res = await get("/og/profile/definitely_not_a_real_user.png");
    expect(res.status).toBe(404);
  });
});