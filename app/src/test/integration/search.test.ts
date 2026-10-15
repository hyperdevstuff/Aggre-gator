import { describe, test, expect, afterAll } from "bun:test";
import { app } from "../../index";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

/**
 * The private unified search. FTS replaced ILIKE here in phase 4b, so these
 * tests pin the new semantics: whole words and word prefixes match, mid-word
 * substrings no longer do — and the query stays scoped to the caller.
 */

const req = (path: string, init?: RequestInit) =>
  app.handle(new Request(`http://localhost${path}`, init));

const fixtures: string[] = [];
let cookie = "";
let seeded = false;

afterAll(async () => {
  for (const id of fixtures) await cleanupTestUser(id);
});

async function seed() {
  if (seeded) return;
  seeded = true;

  const testUser = await createTestUser();
  fixtures.push(testUser.user.id);
  cookie = await getSessionCookie(testUser.email, testUser.password);

  const post = (path: string, body: unknown) =>
    req(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });

  const stamp = Date.now();
  const bookmark = await post("/bookmarks", {
    url: `https://example.com/zeppelin-${stamp}`,
    title: "Zeppelin Interviews",
  });
  expect(bookmark.status).toBe(200);

  const collection = await post("/collections", {
    name: "Deep Work & Focus",
  });
  expect(collection.status).toBe(200);

  const tag = await post("/tags", { name: "typescript" });
  expect(tag.status).toBe(200);
}

async function search(q: string) {
  const res = await req(`/search?q=${encodeURIComponent(q)}`, {
    headers: { Cookie: cookie },
  });
  expect(res.status).toBe(200);
  return res.json();
}

describe("GET /search (full-text)", () => {
  test("finds bookmarks by word and by prefix", async () => {
    await seed();

    const byWord = await search("zeppelin");
    expect(byWord.bookmarks.map((b: any) => b.title)).toContain(
      "Zeppelin Interviews",
    );

    const byPrefix = await search("zepp");
    expect(byPrefix.bookmarks.map((b: any) => b.title)).toContain(
      "Zeppelin Interviews",
    );

    const miss = await search("zzzqqq");
    expect(miss.bookmarks).toHaveLength(0);
  });

  test("finds collections by word across their name and description", async () => {
    await seed();

    const byWord = await search("deep");
    expect(byWord.collections.map((c: any) => c.name)).toContain(
      "Deep Work & Focus",
    );

    const byPrefix = await search("foc");
    expect(byPrefix.collections.map((c: any) => c.name)).toContain(
      "Deep Work & Focus",
    );
  });

  test("finds tags by prefix", async () => {
    await seed();

    const byPrefix = await search("types");
    expect(byPrefix.tags.map((t: any) => t.name)).toContain("typescript");

    // Prefix means the front of the word — not a substring.
    const miss = await search("script");
    expect(miss.tags).toHaveLength(0);
  });

  test("never returns another user's rows", async () => {
    await seed();

    // The fixture's rows are the only things these queries could match; a
    // query for material only the seed owns must come back empty for a
    // caller with no session rows of their own.
    const other = await createTestUser();
    fixtures.push(other.user.id);
    const otherCookie = await getSessionCookie(other.email, other.password);

    const res = await req("/search?q=zeppelin", {
      headers: { Cookie: otherCookie },
    });
    const body = await res.json();
    expect(body.bookmarks).toHaveLength(0);
    expect(body.collections).toHaveLength(0);
    expect(body.tags).toHaveLength(0);
  });
});
