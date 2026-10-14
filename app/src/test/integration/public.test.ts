import { describe, test, expect, afterAll } from "bun:test";
import { app } from "../../index";
import { db } from "../../db";
import { user } from "../../db/schema";
import { eq } from "drizzle-orm";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

/**
 * Public layer: `/u/:username`, `/u/:username/:slug`, and the visibility rules
 * that decide what Explore may enumerate.
 */

const req = (path: string, init?: RequestInit) =>
  app.handle(new Request(`http://localhost${path}`, init));

/**
 * Fetch and parse in one step. A `Response` body is single-use, and several
 * tests below need the status *and* the payload from one request — reading
 * `.json()` twice raises "Body already used".
 */
async function json(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: any }> {
  const res = await req(path, init);
  const text = await res.text();
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, body: text };
  }
}

const authJson = (
  cookie: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> =>
  json(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(init.headers as Record<string, string> | undefined),
    },
  });

type Fixture = {
  userId: string;
  cookie: string;
  username: string;
  /** Create a collection; resolves with the parsed row. */
  newCollection: (body: Record<string, unknown>) => Promise<any>;
  /** Create a bookmark; resolves with `{ status, body }`. */
  newBookmark: (body: Record<string, unknown>) => Promise<any>;
  publish: (id: string, body: Record<string, unknown>) => Promise<any>;
};

const fixtures: string[] = [];

async function setup(usernamePrefix: string): Promise<Fixture> {
  const testUser = await createTestUser();
  fixtures.push(testUser.user.id);
  const cookie = await getSessionCookie(testUser.email, testUser.password);
  // A unique username per fixture so /u/... lookups are unambiguous.
  const username = `${usernamePrefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const patched = await authJson(cookie, "/user/profile", {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
  expect(patched.status).toBe(200);
  return {
    userId: testUser.user.id,
    cookie,
    username,
    newCollection: async (body) =>
      (await authJson(cookie, "/collections", { method: "POST", body: JSON.stringify(body) }))
        .body,
    newBookmark: (body) =>
      authJson(cookie, "/bookmarks", { method: "POST", body: JSON.stringify(body) }),
    publish: (id, body) =>
      authJson(cookie, `/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  };
}

afterAll(async () => {
  for (const id of fixtures) await cleanupTestUser(id);
});

describe("GET /u/:username (public profile)", () => {
  test("serves a profile with only its published collections", async () => {
    const f = await setup("prof");
    const published = await f.newCollection({ name: "Public Things" });
    await f.publish(published.id, { visibility: "public" });
    const hidden = await f.newCollection({ name: "Private Things" });

    const { status, body } = await json(`/u/${f.username}`);
    expect(status).toBe(200);

    expect(body.profile.username).toBe(f.username);
    expect(body.profile.stats.publicCollections).toBe(1);
    const names = body.collections.data.map((c: any) => c.name);
    expect(names).toContain("Public Things");
    expect(names).not.toContain("Private Things");
    expect(names).not.toContain("Unsorted");
    // The private collection exists but must not be reachable through the
    // profile by id either.
    expect(JSON.stringify(body)).not.toContain(hidden.id);
  });

  test("is case-insensitive on the username", async () => {
    const f = await setup("case");
    const lower = await json(`/u/${f.username.toLowerCase()}`);
    const upper = await json(`/u/${f.username.toUpperCase()}`);
    expect(lower.status).toBe(200);
    expect(upper.status).toBe(200);
    expect(upper.body.profile.username).toBe(f.username);
  });

  test("404s an unknown username", async () => {
    const { status } = await json("/u/nobody_at_all_here");
    expect(status).toBe(404);
  });

  test("never exposes email, plan or verification state", async () => {
    const f = await setup("leak");
    const raw = await (await req(`/u/${f.username}`)).text();
    expect(raw).not.toContain("@example.com");
    expect(raw).not.toContain("emailVerified");
    expect(raw).not.toContain("plan");
  });

  test("works without a session", async () => {
    // No Cookie header at all: this is the anonymous-reader path.
    const f = await setup("anon");
    const { status } = await json(`/u/${f.username}`);
    expect(status).toBe(200);
  });

  test("counts a bookmark once even when filed in two published collections", async () => {
    const f = await setup("dupe");
    const a = await f.newCollection({ name: "Alpha" });
    const b = await f.newCollection({ name: "Beta" });
    for (const col of [a, b]) await f.publish(col.id, { visibility: "public" });
    const bm = await f.newBookmark({
      url: `https://example.com/dup-${Date.now()}`,
      title: "Filed twice",
      collectionIds: [a.id, b.id],
    });
    expect(bm.status).toBe(200);

    const { body } = await json(`/u/${f.username}`);
    expect(body.profile.stats.publicCollections).toBe(2);
    // The distinct count is the point: a naive join would report 2.
    expect(body.profile.stats.publicBookmarks).toBe(1);
  });

  test("collection cards carry covers and the subtree count", async () => {
    const f = await setup("profcover");
    const col = await f.newCollection({ name: "Covered Collection" });
    await f.publish(col.id, { visibility: "public" });
    const stamp = Date.now();
    await f.newBookmark({
      url: `https://example.com/only-${stamp}`,
      title: "Only one",
      cover: `https://cdn.example.com/only-${stamp}.png`,
      collectionIds: [col.id],
    });

    const { body } = await json(`/u/${f.username}`);
    const row = body.collections.data.find((c: any) => c.id === col.id);
    expect(row).toBeTruthy();
    expect(row.bookmarkCount).toBe(1);
    expect(row.covers).toEqual([`https://cdn.example.com/only-${stamp}.png`]);
  });
});

describe("GET /u/:username/:slug (public collection)", () => {
  test("serves a published collection and its bookmarks", async () => {
    const f = await setup("coll");
    const col = await f.newCollection({ name: "Reading List" });
    await f.newBookmark({
      url: `https://example.com/a-${Date.now()}`,
      title: "First link",
      collectionIds: [col.id],
    });
    const published = await f.publish(col.id, { visibility: "public" });
    expect(published.status).toBe(200);
    expect(published.body.slug).toBe("reading-list");

    const { status, body } = await json(`/u/${f.username}/reading-list`);
    expect(status).toBe(200);
    expect(body.collection.name).toBe("Reading List");
    expect(body.bookmarks.data.length).toBe(1);
    expect(body.owner.username).toBe(f.username);
    // The unlisted fallback, so a client can offer the code URL too.
    expect(body.shareCode === null || typeof body.shareCode === "string").toBe(
      true,
    );
  });

  test("derives a slug from the name when none is given", async () => {
    const f = await setup("derive");
    const col = await f.newCollection({ name: "Deep Work & Focus" });
    const published = await f.publish(col.id, { visibility: "public" });
    expect(published.body.slug).toBe("deep-work-focus");
  });

  test("serves an unlisted collection by link without listing it", async () => {
    const f = await setup("unlisted");
    const col = await f.newCollection({ name: "Quiet Corner" });
    await f.publish(col.id, { visibility: "unlisted", slug: "quiet-corner" });

    const { status } = await json(`/u/${f.username}/quiet-corner`);
    expect(status).toBe(200);

    // …but absent from Explore, which lists `public` only.
    const explore = await json("/u/explore?limit=100");
    expect(explore.body.data.some((row: any) => row.id === col.id)).toBe(false);
  });

  test("404s a private collection rather than 403", async () => {
    const f = await setup("priv");
    await f.newCollection({ name: "Secret", slug: "secret" });
    const { status } = await json(`/u/${f.username}/secret`);
    // 404, not 403: a 403 confirms the collection exists to a guesser.
    expect(status).toBe(404);
  });

  test("404s a slug belonging to another user", async () => {
    const a = await setup("ownera");
    const b = await setup("ownerb");
    const col = await a.newCollection({ name: "A Collection", slug: "a-collection" });
    await a.publish(col.id, { visibility: "public" });
    const { status } = await json(`/u/${b.username}/a-collection`);
    expect(status).toBe(404);
  });

  test("404s a slug with no matching collection", async () => {
    const f = await setup("noslug");
    const { status } = await json(`/u/${f.username}/nothing-here`);
    expect(status).toBe(404);
  });

  test("does not expose note or isFavorite", async () => {
    const f = await setup("narrow");
    const col = await f.newCollection({ name: "Private Bits" });
    await f.newBookmark({
      url: `https://example.com/n-${Date.now()}`,
      title: "Has a note",
      note: "secret note text",
      collectionIds: [col.id],
    });
    await f.publish(col.id, { visibility: "public", slug: "private-bits" });

    const raw = await (await req(`/u/${f.username}/private-bits`)).text();
    expect(raw).not.toContain("secret note text");
    expect(raw).not.toContain("isFavorite");
  });

  test("excludes archived bookmarks from the public page", async () => {
    const f = await setup("arch");
    const col = await f.newCollection({ name: "Has Archived" });
    await f.newBookmark({
      url: `https://example.com/keep-${Date.now()}`,
      title: "Still here",
      collectionIds: [col.id],
    });
    const drop = await f.newBookmark({
      url: `https://example.com/drop-${Date.now()}`,
      title: "Archived away",
      collectionIds: [col.id],
    });
    const archived = await authJson(f.cookie, `/bookmarks/${drop.body.id}/archive`, {
      method: "POST",
    });
    expect(archived.status).toBe(200);
    await f.publish(col.id, { visibility: "public", slug: "has-archived" });

    const { body } = await json(`/u/${f.username}/has-archived`);
    const titles = body.bookmarks.data.map((b: any) => b.title);
    expect(titles).toContain("Still here");
    expect(titles).not.toContain("Archived away");
  });

  test("a published parent does not expose a private child's bookmarks", async () => {
    const f = await setup("subtree");
    const parent = await f.newCollection({ name: "Parent" });
    const child = await f.newCollection({
      name: "Private Child",
      parentId: parent.id,
      slug: "private-child",
    });
    await f.newBookmark({
      url: `https://example.com/child-${Date.now()}`,
      title: "Child secret",
      collectionIds: [child.id],
    });
    await f.publish(parent.id, { visibility: "public", slug: "parent" });

    const { body } = await json(`/u/${f.username}/parent`);
    const titles = body.bookmarks.data.map((b: any) => b.title);
    // Publishing the parent must not implicitly publish the child.
    expect(titles).not.toContain("Child secret");
    expect(body.nestedCollections.map((c: any) => c.name)).not.toContain(
      "Private Child",
    );
    // And the child's own slug URL stays closed.
    const viaSlug = await json(`/u/${f.username}/private-child`);
    expect(viaSlug.status).toBe(404);
  });
});

describe("publishing preconditions", () => {
  test("refuses to publish without a username", async () => {
    const testUser = await createTestUser();
    fixtures.push(testUser.user.id);
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    // Strip the auto-assigned username to simulate a pre-phase-3 account.
    await db.update(user).set({ username: null }).where(eq(user.id, testUser.user.id));

    const col = (
      await authJson(cookie, "/collections", {
        method: "POST",
        body: JSON.stringify({ name: "No User" }),
      })
    ).body;
    const res = await authJson(cookie, `/collections/${col.id}`, {
      method: "PATCH",
      body: JSON.stringify({ visibility: "public" }),
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("username");
  });

  test("refuses a derived slug already used by the owner", async () => {
    const f = await setup("collide");
    // Distinct names — a per-owner unique index on `name` would reject the
    // second outright — but both derive the slug "taken-name".
    const first = await f.newCollection({ name: "Taken Name" });
    const second = await f.newCollection({ name: "taken name" });
    const taken = await f.publish(first.id, { visibility: "public" });
    expect(taken.status).toBe(200);
    expect(taken.body.slug).toBe("taken-name");

    const res = await f.publish(second.id, { visibility: "public" });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("taken-name");
  });

  test("stamps publishedAt on publish and clears it on unpublish", async () => {
    const f = await setup("stamp");
    const col = await f.newCollection({ name: "Stamped" });

    const priv = (
      await authJson(f.cookie, `/collections/${col.id}`)
    ).body;
    expect(priv.publishedAt).toBeNull();

    const pub = (await f.publish(col.id, { visibility: "public" })).body;
    expect(pub.publishedAt).not.toBeNull();

    const unpub = (await f.publish(col.id, { visibility: "private" })).body;
    expect(unpub.publishedAt).toBeNull();
  });

  test("changing the slug of a published collection keeps it published", async () => {
    const f = await setup("reslug");
    const col = await f.newCollection({ name: "Original" });
    await f.publish(col.id, { visibility: "public" });

    const res = await f.publish(col.id, { slug: "renamed-collection" });
    expect(res.status).toBe(200);
    expect(res.body.visibility).toBe("public");
    expect(res.body.publishedAt).not.toBeNull();
    const { status } = await json(`/u/${f.username}/renamed-collection`);
    expect(status).toBe(200);
  });

  test("system collections cannot be published", async () => {
    const f = await setup("system");
    const all = (await authJson(f.cookie, "/collections")).body;
    const system = all.find((c: any) => c.isSystem);
    expect(system).toBeDefined();
    const res = await f.publish(system.id, { visibility: "public" });
    expect(res.status).toBe(409);
  });
});

describe("GET /u/explore", () => {
  test("lists published collections newest first", async () => {
    const f = await setup("exp");
    const first = await f.newCollection({ name: "Older Post" });
    await f.publish(first.id, { visibility: "public" });
    const second = await f.newCollection({ name: "Newer Post" });
    await f.publish(second.id, { visibility: "public" });

    const { body } = await json("/u/explore?limit=100");
    const mine = body.data.filter((row: any) => row.username === f.username);
    const titles = mine.map((row: any) => row.name);
    expect(titles).toContain("Older Post");
    expect(titles).toContain("Newer Post");
    expect(titles.indexOf("Newer Post")).toBeLessThan(
      titles.indexOf("Older Post"),
    );
  });

  test("omits unlisted and private collections", async () => {
    const f = await setup("filtered");
    for (const visibility of ["private", "unlisted"]) {
      const col = await f.newCollection({ name: `${visibility} Item` });
      await f.publish(col.id, { visibility });
    }
    const { body } = await json("/u/explore?limit=100");
    const titles = body.data.map((row: any) => row.name);
    expect(titles).not.toContain("private Item");
    expect(titles).not.toContain("unlisted Item");
  });

  test("carries the username and slug for readable links", async () => {
    const f = await setup("links");
    const col = await f.newCollection({ name: "Readable" });
    await f.publish(col.id, { visibility: "public" });
    const { body } = await json("/u/explore?limit=100");
    const row = body.data.find((r: any) => r.name === "Readable");
    expect(row.username).toBe(f.username);
    expect(row.slug).toBe("readable");
  });

  test("counts and covers span non-private sub-collections", async () => {
    const f = await setup("subtree");
    const parent = await f.newCollection({ name: "Parent Shelf" });
    const child = await f.newCollection({
      name: "Child Shelf",
      parentId: parent.id,
    });
    await f.publish(parent.id, { visibility: "public" });
    // Unlisted, not public: the child contributes to the parent's count and
    // covers without being enumerated in Explore itself.
    await f.publish(child.id, { visibility: "unlisted" });

    const stamp = Date.now();
    await f.newBookmark({
      url: `https://example.com/p-${stamp}`,
      title: "In parent",
      cover: `https://cdn.example.com/p-${stamp}.png`,
      collectionIds: [parent.id],
    });
    await f.newBookmark({
      url: `https://example.com/c1-${stamp}`,
      title: "Child one",
      cover: `https://cdn.example.com/c1-${stamp}.png`,
      collectionIds: [child.id],
    });
    await f.newBookmark({
      url: `https://example.com/c2-${stamp}`,
      title: "Child two",
      cover: `https://cdn.example.com/c2-${stamp}.png`,
      collectionIds: [child.id],
    });

    const { body } = await json("/u/explore?limit=100");
    const row = body.data.find((r: any) => r.id === parent.id);
    expect(row).toBeTruthy();
    // The parent's own bookmark plus the child's two — the count is the subtree.
    expect(row.bookmarkCount).toBe(3);
    expect(row.covers).toHaveLength(3);
    expect(row.covers).toContain(`https://cdn.example.com/c1-${stamp}.png`);
    // The unlisted child is not itself listed.
    expect(body.data.some((r: any) => r.id === child.id)).toBe(false);
  });

  test("covers stop at four; archived and private-child bookmarks do not count", async () => {
    const f = await setup("cap");
    const parent = await f.newCollection({ name: "Cap Parent" });
    const privateChild = await f.newCollection({
      name: "Cap Private Child",
      parentId: parent.id,
    });
    await f.publish(parent.id, { visibility: "public" });

    const stamp = Date.now();
    const createdIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await f.newBookmark({
        url: `https://example.com/cap-${i}-${stamp}`,
        title: `Cap ${i}`,
        cover: `https://cdn.example.com/cap-${i}-${stamp}.png`,
        collectionIds: [parent.id],
      });
      createdIds.push(res.body.id);
    }
    // Sits in a private child: must not contribute to the public parent.
    await f.newBookmark({
      url: `https://example.com/hidden-${stamp}`,
      title: "Hidden",
      cover: `https://cdn.example.com/hidden-${stamp}.png`,
      collectionIds: [privateChild.id],
    });
    const archived = await authJson(
      f.cookie,
      `/bookmarks/${createdIds[0]}/archive`,
      { method: "POST" },
    );
    expect(archived.status).toBe(200);

    const { body } = await json("/u/explore?limit=100");
    const row = body.data.find((r: any) => r.id === parent.id);
    expect(row.bookmarkCount).toBe(5); // 6 minus the archived one
    expect(row.covers).toHaveLength(4); // capped
    expect(row.covers).not.toContain(
      `https://cdn.example.com/hidden-${stamp}.png`,
    );
  });

  test("honours ?q=", async () => {
    const f = await setup("searchable");
    const col = await f.newCollection({ name: "Zeppelin Notes" });
    await f.publish(col.id, { visibility: "public" });
    const hit = await json("/u/explore?q=zeppelin&limit=100");
    expect(hit.body.data.some((r: any) => r.name === "Zeppelin Notes")).toBe(
      true,
    );
    const miss = await json("/u/explore?q=nonexistentxyzq&limit=100");
    expect(miss.body.data.some((r: any) => r.username === f.username)).toBe(
      false,
    );
  });

  test("a share code alone no longer lists a collection in Explore", async () => {
    // The regression this guards: previously any active share row made a
    // collection appear, so "unlisted" did not exist as a tier.
    const f = await setup("codelist");
    const col = await f.newCollection({ name: "Coded Only" });
    const share = await authJson(f.cookie, `/collections/${col.id}/share`, {
      method: "POST",
    });
    expect(share.status).toBe(200);

    const explore = await json("/u/explore?limit=100");
    expect(explore.body.data.some((row: any) => row.id === col.id)).toBe(false);

    // …but the code still works for whoever holds the link.
    const own = (await authJson(f.cookie, `/collections/${col.id}`)).body;
    expect(own.visibility).toBe("private");
    const publicPage = await req(`/share/${share.body.shareCode}`);
    expect(publicPage.status).toBe(200);
  });
});

describe("GET /share/explore compatibility", () => {
  test("filters by visibility like /u/explore", async () => {
    const f = await setup("compat");
    const priv = await f.newCollection({ name: "Compat Private" });
    await authJson(f.cookie, `/collections/${priv.id}/share`, { method: "POST" });
    const pub = await f.newCollection({ name: "Compat Public" });
    await f.publish(pub.id, { visibility: "public" });

    const { body } = await json("/share/explore?limit=100");
    const names = body.data.map((row: any) => row.name);
    expect(names).toContain("Compat Public");
    expect(names).not.toContain("Compat Private");
  });
});