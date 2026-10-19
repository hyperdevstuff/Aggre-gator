/**
 * Verification gates publishing (`be-07`).
 *
 * The rule under test is narrow and load-bearing: an unverified account is a
 * first-class account. It signs in, saves bookmarks, creates collections and
 * edits them — everything short of putting its content in front of an anonymous
 * reader, which is refused with a typed error.
 *
 * Both halves matter. Testing only the refusal would pass just as happily
 * against a gate that blocked everything, which is the failure mode TASKS.md
 * warns about ("it gates who may *publish*, not who may exist").
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import {
  createTestUser,
  getSessionCookie,
  cleanupTestUser,
} from "./setup";

describe("publishing is gated on a verified email", () => {
  let verifiedId: string;
  let verifiedCookie: string;
  let unverifiedId: string;
  let unverifiedCookie: string;

  const request = (path: string, body: unknown, cookie: string, method = "POST") =>
    app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(body),
      }),
    );

  /** Create a collection; returns the parsed response body. */
  async function createCollection(body: Record<string, unknown>, cookie: string) {
    const res = await request("/collections", body, cookie);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  beforeAll(async () => {
    const verified = await createTestUser();
    verifiedId = verified.user.id;
    verifiedCookie = await getSessionCookie(verified.email, verified.password);

    const unverified = await createTestUser({ verified: false });
    unverifiedId = unverified.user.id;
    unverifiedCookie = await getSessionCookie(unverified.email, unverified.password);
  });

  afterAll(async () => {
    await cleanupTestUser(verifiedId);
    await cleanupTestUser(unverifiedId);
  });

  describe("an unverified user is a full user until they publish", () => {
    test("signs in", async () => {
      expect(unverifiedCookie).toContain("better-auth.session_token");
    });

    test("saves a bookmark", async () => {
      const res = await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: unverifiedCookie,
          },
          body: JSON.stringify({
            url: "https://example.com/unverified",
            title: "Saved Before Verifying",
          }),
        }),
      );
      expect(res.status).toBe(200);
      expect((await res.json()).title).toBe("Saved Before Verifying");
    });

    test("creates a private collection with no objection", async () => {
      const { status, body } = await createCollection(
        { name: "Private Drafts" },
        unverifiedCookie,
      );
      expect(status).toBe(200);
      // `private` is the owner filing, not a publication, so it is never gated.
      expect(body.visibility).toBe("private");
    });

    test("creates a collection with no visibility field at all", async () => {
      // The default is `private`, so an omitted `visibility` is never a
      // publication and must never be gated.
      const { status, body } = await createCollection(
        { name: "Implicitly Private" },
        unverifiedCookie,
      );
      expect(status).toBe(200);
      expect(body.visibility).toBe("private");
    });

    test("can still rename a collection it already owns", async () => {
      const created = await createCollection({ name: "Renameable" }, unverifiedCookie);
      const res = await request(
        `/collections/${created.body.id}`,
        { name: "Renamed" },
        unverifiedCookie,
        "PATCH",
      );
      expect(res.status).toBe(200);
      expect((await res.json()).name).toBe("Renamed");
    });
  });

  describe("but is refused at every publication route", () => {
    test("POST /collections with visibility=public", async () => {
      const publish = await createCollection(
        { name: "Spam Page", visibility: "public" },
        unverifiedCookie,
      );
      expect(publish.status).toBe(403);
      expect(publish.body.code).toBe("EMAIL_NOT_VERIFIED");
      expect(publish.body.error).toContain("Verify your email");
    });

    test("POST /collections with visibility=unlisted", async () => {
      // The judgment call in this issue: `unlisted` is not *listed*, but it is
      // read by anyone who has the address — `/u/:username/:slug` serves every
      // non-private collection, and a share code is that address. Leaving this
      // tier open would hand a spam account a publishing surface for free.
      const publish = await createCollection(
        { name: "Quiet Spam", visibility: "unlisted" },
        unverifiedCookie,
      );
      expect(publish.status).toBe(403);
      expect(publish.body.code).toBe("EMAIL_NOT_VERIFIED");
    });

    test("PATCH /collections/:id up to public", async () => {
      const created = await createCollection({ name: "Draft" }, unverifiedCookie);
      const res = await request(
        `/collections/${created.body.id}`,
        { visibility: "public" },
        unverifiedCookie,
        "PATCH",
      );
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("EMAIL_NOT_VERIFIED");
    });

    test("PATCH /collections/:id up to unlisted", async () => {
      const created = await createCollection({ name: "Draft Two" }, unverifiedCookie);
      const res = await request(
        `/collections/${created.body.id}`,
        { visibility: "unlisted" },
        unverifiedCookie,
        "PATCH",
      );
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("EMAIL_NOT_VERIFIED");
    });

    test("POST /collections/:id/share", async () => {
      const created = await createCollection({ name: "Shareable" }, unverifiedCookie);
      const res = await request(
        `/collections/${created.body.id}/share`,
        {},
        unverifiedCookie,
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe("EMAIL_NOT_VERIFIED");
      // The refusal has to say how to fix itself, or the client can only show
      // an error.
      expect(body.details.resendVerificationUrl).toBe(
        "/api/auth/send-verification-email",
      );
      expect(body.details.emailVerified).toBe(false);
    });

    test("the refusal is traceable: it carries an x-request-id", async () => {
      // `EmailVerificationRequiredError` is deliberately absent from
      // errorPlugin's `.error({...})` map, so it is answered by the generic
      // `instanceof ApiError` branch. That branch is the one that attaches the
      // request id (ELYSIA-NOTES §2) — this is what would catch that decision
      // being wrong, and it is the only consequence of leaving the class out.
      const res = await request(
        "/collections",
        { name: "Untraceable", visibility: "public" },
        unverifiedCookie,
      );

      expect(res.status).toBe(403);
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });
  });

  describe("the flag the client branches on", () => {
    test("GET /user/me reports emailVerified for both account types", async () => {
      // This is the contract `agg-fe` builds the account screen against: it has
      // to know which state the account is in without inferring it from a failed
      // publish.
      const read = async (cookie: string) => {
        const res = await app.handle(
          new Request("http://localhost/user/me", {
            headers: { Cookie: cookie },
          }),
        );
        expect(res.status).toBe(200);
        return (await res.json()) as { emailVerified: boolean };
      };

      expect((await read(verifiedCookie)).emailVerified).toBe(true);
      expect((await read(unverifiedCookie)).emailVerified).toBe(false);
    });
  });

  describe("a verified user is unaffected", () => {
    test("publishes a collection", async () => {
      const { status, body } = await createCollection(
        { name: "Real Page", visibility: "public" },
        verifiedCookie,
      );
      expect(status).toBe(200);
      expect(body.visibility).toBe("public");
      expect(body.publishedAt).toBeTruthy();
    });

    test("shares a collection", async () => {
      const created = await createCollection({ name: "Shared" }, verifiedCookie);
      const res = await request(
        `/collections/${created.body.id}/share`,
        {},
        verifiedCookie,
      );
      expect(res.status).toBe(200);
      expect((await res.json()).shareCode).toBeTruthy();
    });

    test("moves an existing collection back to private without complaint", async () => {
      // Un-publishing is always allowed, verified or not: taking something down
      // must never need a permission the owner might have lost.
      const created = await createCollection(
        { name: "To Unpublish", visibility: "public" },
        verifiedCookie,
      );
      const res = await request(
        `/collections/${created.body.id}`,
        { visibility: "private" },
        verifiedCookie,
        "PATCH",
      );
      expect(res.status).toBe(200);
      expect((await res.json()).publishedAt).toBeNull();
    });
  });
});
