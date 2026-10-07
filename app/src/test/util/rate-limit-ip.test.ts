import { describe, test, expect, beforeEach } from "bun:test";
import { rateLimitGuard, resetRateLimits } from "../../utils/rate-limit";
import { env } from "../../env";

function makeContext(ip: string, path = "/bookmarks") {
  return {
    request: new Request(`http://localhost${path}`),
    path,
    set: { headers: {} as Record<string, string | number | undefined> },
    server: { requestIP: () => ({ address: ip }) },
  };
}

describe("rate limit client identification", () => {
  beforeEach(() => resetRateLimits());

  test("counts each peer address separately", async () => {
    const guard = rateLimitGuard({ name: "test:ip", limit: 1, perUser: false });

    await guard(makeContext("10.0.0.1"));
    await expect(guard(makeContext("10.0.0.2"))).resolves.toBeUndefined();
    await expect(guard(makeContext("10.0.0.1"))).rejects.toThrow(/Too many/);
  });

  test("ignores forwarding headers unless TRUST_PROXY is on", async () => {
    // Spoofing a header must not mint a fresh budget when the API is directly
    // exposed: the socket address is what counts.
    expect(env.TRUST_PROXY).toBe(false);
    const guard = rateLimitGuard({ name: "test:spoof", limit: 1, perUser: false });

    const first = makeContext("10.0.0.1");
    first.request.headers.set("x-forwarded-for", "203.0.113.9");
    await guard(first);

    const second = makeContext("10.0.0.1");
    second.request.headers.set("x-forwarded-for", "198.51.100.4");
    await expect(guard(second)).rejects.toThrow(/Too many/);
  });

  test("sets the informational headers on allowed requests", async () => {
    const guard = rateLimitGuard({ name: "test:headers", limit: 5 });
    const ctx = makeContext("10.0.0.3");

    await guard(ctx);

    expect(ctx.set.headers["x-ratelimit-limit"]).toBe("5");
    expect(ctx.set.headers["x-ratelimit-remaining"]).toBe("4");
    expect(Number(ctx.set.headers["x-ratelimit-reset"])).toBeGreaterThan(0);
  });

  test("skips exempt paths entirely", async () => {
    const guard = rateLimitGuard({
      name: "test:exempt",
      limit: 1,
      exempt: ["/health"],
    });

    // Exempt requests never touch the counter, so the first limited call still
    // has its full budget of one.
    await guard(makeContext("10.0.0.4", "/health"));
    await guard(makeContext("10.0.0.4", "/health"));
    await expect(guard(makeContext("10.0.0.4"))).resolves.toBeUndefined();
    await expect(guard(makeContext("10.0.0.4"))).rejects.toThrow(/Too many/);
  });
});