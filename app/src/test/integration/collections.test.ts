import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

describe("collections api — 3-level nesting cap", () => {
  let cookie: string;
  let userId: string;

  /** Every test builds its own fixtures so no test depends on another's mutations. */
  const create = async (name: string, parentId?: string) => {
    const res = await app.handle(
      new Request("http://localhost/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name, parentId }),
      }),
    );
    return res;
  };

  const createOk = async (name: string, parentId?: string) => {
    const res = await create(name, parentId);
    expect(res.status).toBe(200);
    return res.json() as Promise<{ id: string; parentId: string | null }>;
  };

  const patch = async (id: string, body: object) =>
    app.handle(
      new Request(`http://localhost/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(body),
      }),
    );

  beforeAll(async () => {
    const testUser = await createTestUser();
    userId = testUser.user.id;
    cookie = await getSessionCookie(testUser.email, testUser.password);
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
  });

  test("creates 3 levels and rejects a 4th", async () => {
    const level1 = await createOk("Cap L1");
    const level2 = await createOk("Cap L2", level1.id);
    const level3 = await createOk("Cap L3", level2.id);

    const res = await create("Cap L4", level3.id);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("3 levels");
  });

  test("rejects moving a collection into its own descendant", async () => {
    const level1 = await createOk("Cycle L1");
    const level2 = await createOk("Cycle L2", level1.id);
    const level3 = await createOk("Cycle L3", level2.id);

    const res = await patch(level1.id, { parentId: level3.id });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("itself or its descendants");
  });

  test("subtree-aware move: rejected when a descendant would exceed depth 3", async () => {
    // Chain of 3: Root height 3. Any parent at depth ≥ 1 puts the leaf past level 3.
    const root = await createOk("Sub L1");
    const mid = await createOk("Sub L2", root.id);
    await createOk("Sub L3", mid.id);
    const other = await createOk("Sub Other");

    const res = await patch(root.id, { parentId: other.id });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("3 levels");
  });

  test("subtree move is allowed when the whole subtree still fits in 3 levels", async () => {
    // Height-2 chain moved under a top-level parent: children land at depth 3 — legal.
    const root = await createOk("Fit L1");
    const child = await createOk("Fit L2", root.id);
    const other = await createOk("Fit Other");

    const res = await patch(root.id, { parentId: other.id });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parentId).toBe(other.id);

    // And the moved child is still reachable in the listing with its parent.
    const list = await app.handle(
      new Request("http://localhost/collections", { headers: { Cookie: cookie } }),
    );
    const all = await list.json();
    expect(all.find((c: { id: string }) => c.id === child.id).parentId).toBe(root.id);
  });

  test("moving back to top level clears the parent", async () => {
    const level1 = await createOk("Clear L1");
    const child = await createOk("Clear L2", level1.id);

    const res = await patch(child.id, { parentId: null });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parentId).toBeNull();
  });

  test("listing returns nested collections with parentId (not just top level)", async () => {
    const level1 = await createOk("List L1");
    const level2 = await createOk("List L2", level1.id);

    const res = await app.handle(
      new Request("http://localhost/collections", { headers: { Cookie: cookie } }),
    );
    expect(res.status).toBe(200);
    const all = await res.json();
    const parent = all.find((c: { id: string }) => c.id === level1.id);
    const child = all.find((c: { id: string }) => c.id === level2.id);
    expect(parent.parentId).toBeNull();
    expect(child.parentId).toBe(level1.id);
  });

  test("rejects system collections as parents", async () => {
    const res = await app.handle(
      new Request("http://localhost/collections", { headers: { Cookie: cookie } }),
    );
    const all = await res.json();
    const unsorted = all.find((c: { slug: string | null }) => c.slug === "unsorted");
    expect(unsorted).toBeDefined();

    const child = await create("Under Unsorted", unsorted.id);
    expect(child.status).toBe(409);
    const body = await child.json();
    expect(body.error).toContain("System collections");
  });
});

describe("collections api — hardening", () => {
  let userA: { id: string };
  let cookieA: string;
  let userB: { id: string };
  let cookieB: string;

  const req = (path: string, cookie: string, init?: RequestInit) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          ...(init?.headers ?? {}),
        },
      }),
    );

  const createAs = (cookie: string, body: Record<string, unknown>) =>
    req("/collections", cookie, { method: "POST", body: JSON.stringify(body) });

  const createOkAs = async (cookie: string, body: Record<string, unknown>) => {
    const res = await createAs(cookie, body);
    expect(res.status).toBe(200);
    return res.json() as Promise<{ id: string }>;
  };

  const patchAs = (cookie: string, id: string, body: Record<string, unknown>) =>
    req(`/collections/${id}`, cookie, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    const a = await createTestUser();
    userA = a.user;
    cookieA = await getSessionCookie(a.email, a.password);
    const b = await createTestUser();
    userB = b.user;
    cookieB = await getSessionCookie(b.email, b.password);
  });

  afterAll(async () => {
    await cleanupTestUser(userA.id);
    await cleanupTestUser(userB.id);
  });

  test("GET /:id/bookmarks is 404 for another user's collection", async () => {
    const foreign = await createOkAs(cookieB, { name: "B private" });
    const res = await req(`/collections/${foreign.id}/bookmarks`, cookieA);
    expect(res.status).toBe(404);
  });

  test("GET /:id/bookmarks is 404 for a nonexistent collection", async () => {
    const res = await req(
      `/collections/${crypto.randomUUID()}/bookmarks`,
      cookieA,
    );
    expect(res.status).toBe(404);
  });

  test("GET /:id returns isSystem and slug", async () => {
    const created = await createOkAs(cookieA, {
      name: "Shape check",
      slug: "shape-check",
    });
    const res = await req(`/collections/${created.id}`, cookieA);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isSystem).toBe(false);
    expect(body.slug).toBe("shape-check");
  });

  test("blocks editing a system collection through a non-core field", async () => {
    const list = await req("/collections", cookieA);
    const all = await list.json();
    const unsorted = all.find(
      (c: { slug: string | null }) => c.slug === "unsorted",
    );
    expect(unsorted).toBeDefined();

    const res = await patchAs(cookieA, unsorted.id, { color: "#ffffff" });
    expect(res.status).toBe(409);
  });

  test("rejects a duplicate slug on PATCH", async () => {
    await createOkAs(cookieA, { name: "Slug one", slug: "slug-one" });
    const second = await createOkAs(cookieA, { name: "Slug two" });
    const res = await patchAs(cookieA, second.id, { slug: "slug-one" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Slug");
  });

  test("rejects a duplicate slug on create", async () => {
    await createOkAs(cookieA, { name: "Slug three", slug: "slug-three" });
    const res = await createAs(cookieA, {
      name: "Slug four",
      slug: "slug-three",
    });
    expect(res.status).toBe(409);
  });

  test("rejects a malformed slug", async () => {
    const res = await createAs(cookieA, { name: "Bad slug", slug: "Bad Slug" });
    expect(res.status).toBe(400);
  });

  test("rejects a malformed color", async () => {
    const res = await createAs(cookieA, { name: "Bad color", color: "red" });
    expect(res.status).toBe(400);
  });
});
