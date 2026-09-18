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
