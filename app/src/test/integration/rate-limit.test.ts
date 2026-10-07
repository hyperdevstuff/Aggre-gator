import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { app } from "../../index";
import { resetRateLimits } from "../../utils/rate-limit";

describe("global rate limit", () => {
  beforeEach(() => resetRateLimits());
  afterAll(() => resetRateLimits());

  test("caps every request at 1000/minute per client and returns 429", async () => {
    let limited: Response | undefined;
    let allowed = 0;

    for (let i = 0; i < 1005; i++) {
      const res = await app.handle(new Request("http://localhost/bookmarks"));
      if (res.status === 429) {
        limited = res;
        break;
      }
      allowed++;
    }

    // 1000 in the window, the 1001st is refused. Counting happens in
    // onRequest, so unauthenticated traffic is capped before the session
    // lookup happens.
    expect(allowed).toBe(1000);
    expect(limited).toBeDefined();
    expect(Number(limited!.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await limited!.json()).error).toContain("Too many requests");
  });

  test("never limits health probes or the auth handler", async () => {
    resetRateLimits();

    for (let i = 0; i < 1005; i++) {
      await app.handle(new Request("http://localhost/bookmarks"));
    }

    expect((await app.handle(new Request("http://localhost/health"))).status).toBe(200);
    expect((await app.handle(new Request("http://localhost/api/version"))).status).toBe(200);

    const auth = await app.handle(
      new Request("http://localhost/api/auth/get-session", {
        headers: { Cookie: "session=bogus" },
      }),
    );
    // Rejected by better-auth (or 200 with a null session), never 429.
    expect(auth.status).not.toBe(429);
  });
});