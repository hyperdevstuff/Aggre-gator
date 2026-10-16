/**
 * The `x-request-id` contract as a client sees it.
 *
 * The unit tests in `request-log.test.ts` cover the pure mechanics. These assert
 * the part that can only be verified through the real app: that the header
 * survives Elysia's plugin ordering and actually reaches the wire.
 */
import { describe, test, expect } from "bun:test";
import { app } from "../../index";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

describe("x-request-id", () => {
  test("every response carries a generated id", async () => {
    const res = await app.handle(new Request("http://localhost/health"));

    const id = res.headers.get("x-request-id");
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  test("a caller-supplied id is echoed back verbatim", async () => {
    // The point of the header: a user can send their own id and find the
    // matching server-side lines in one grep.
    const res = await app.handle(
      new Request("http://localhost/health", {
        headers: { "x-request-id": "client-supplied-abc123" },
      }),
    );

    expect(res.headers.get("x-request-id")).toBe("client-supplied-abc123");
  });

  test("a hostile inbound id is replaced, not echoed", async () => {
    // Whitespace, quotes and semicolons are all legal in a header *value* but
    // outside the id alphabet. (A literal newline cannot be tested here: Bun
    // rejects it when constructing the Request, before our code runs — the
    // newline case is covered by the unit tests.)
    for (const hostile of ["abc def", 'abc"def', "abc;def", "x".repeat(500)]) {
      const res = await app.handle(
        new Request("http://localhost/health", {
          headers: { "x-request-id": hostile },
        }),
      );

      const id = res.headers.get("x-request-id") ?? "";
      expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(id).not.toBe(hostile);
    }
  });

  test("an id is present on a 404 from a mounted router", async () => {
    const res = await app.handle(
      new Request("http://localhost/tags/does-not-exist", { method: "PATCH" }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  test("an id is present on an unmatched route", async () => {
    const res = await app.handle(new Request("http://localhost/no-such-route"));

    expect(res.status).toBe(404);
    expect(res.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  test("an id is present on an unauthenticated 401", async () => {
    const res = await app.handle(new Request("http://localhost/bookmarks"));

    expect(res.status).toBe(401);
    expect(res.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  test("an id is present on a validation failure", async () => {
    // Authenticated on purpose: an anonymous POST is rejected 401 before
    // validation runs, which would assert the wrong branch.
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);

    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ notAUrl: true }),
      }),
    );

    expect(res.status).toBe(400);
    expect(res.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9_-]{1,64}$/);

    await cleanupTestUser(testUser.user.id);
  });

  test("distinct requests get distinct ids", async () => {
    const first = await app.handle(new Request("http://localhost/health"));
    const second = await app.handle(new Request("http://localhost/health"));

    expect(first.headers.get("x-request-id")).not.toBe(
      second.headers.get("x-request-id"),
    );
  });

  test("/health is exempt from logging but still carries an id", async () => {
  const res = await app.handle(new Request("http://localhost/health"));

  // Probe traffic is not logged (uptime monitors would bury real requests),
  // but the header is unconditional — the request you check during a Render
  // incident is the one that needs an id most.
  expect(res.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
});
});