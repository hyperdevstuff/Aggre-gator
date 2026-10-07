/**
 * Fixed-window, in-process rate limiting.
 *
 * Purpose here is abuse containment, not accounting: the outbound fetch that
 * `POST /bookmarks` performs makes an unbounded endpoint expensive for whoever
 * calls it, and the public `/share` endpoints are scrapeable by anyone.
 *
 * State is per process and in memory. That is fine for the single-container
 * deployment in `app/Dockerfile`; a multi-replica deployment has to move this
 * store to Postgres/Redis before the limits mean anything.
 */
import { Elysia } from "elysia";
import { TooManyRequestsError } from "../error";
import { env } from "../env";

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
/** Hard cap on tracked keys so a rotating-IP flood cannot grow the map forever. */
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  if (windows.size <= MAX_TRACKED_KEYS) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  // Still oversized: everything left is live, so start over rather than grow.
  if (windows.size > MAX_TRACKED_KEYS) windows.clear();
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Unix ms at which the current window ends. */
  resetAt: number;
};

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  sweep(now);
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    const window: Window = { count: 1, resetAt: now + windowMs };
    windows.set(key, window);
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt: window.resetAt };
  }

  existing.count += 1;
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Test seam: forget every counted window. */
export function resetRateLimits() {
  windows.clear();
}

/**
 * The peer address a limit should count against.
 *
 * Forwarding headers are only honoured when `TRUST_PROXY` is set: they are
 * attacker-controlled unless a proxy overwrites them, and a spoofed value would
 * hand an unlimited budget to whoever rotates it. Everything lands in the same
 * bucket when the real client IP is unknowable (`app.handle()` in tests, no
 * socket) — the global cap still applies, just not per client.
 */
function clientIp(request: Request, socketIp?: string | null): string {
  if (env.TRUST_PROXY) {
    const forwarded =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return socketIp || "unknown";
}

type RateLimitOptions = {
  /** Bucket namespace, so two limits on the same route do not share a counter. */
  name: string;
  /** Requests allowed per window, per key. */
  limit: number;
  windowMs?: number;
  /** Count per authenticated user instead of per client IP. */
  perUser?: boolean;
  /** Request paths to skip entirely (health probes, docs, the auth handler). */
  exempt?: string[];
};

/**
 * The subset of an Elysia context the guard reads. Kept structural so the same
 * function can be used as a router plugin, as a route-level `beforeHandle`, or
 * in a test.
 */
type GuardContext = {
  request: Request;
  path: string;
  set: { headers: Record<string, string | number | undefined> };
  user?: { id?: string };
  server?: { requestIP?: (request: Request) => { address?: string } | null } | null;
};

/**
 * `onRequest` context — runs before `derive`, so there is no `user` and no
 * `path` property yet (the URL is the only source of both). Counting here is
 * what stops an unauthenticated flood from turning into a session-lookup flood.
 */
type RequestGuardContext = {
  request: Request;
  server?: { requestIP?: (request: Request) => { address?: string } | null } | null;
};

function socketAddress(server: RequestGuardContext["server"], request: Request) {
  try {
    return server?.requestIP?.(request)?.address ?? null;
  } catch {
    // No socket (tests drive `app.handle()`), or the address is unavailable.
    return null;
  }
}

function isExempt(path: string, exempt: string[]) {
  return exempt.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function bucketKey(
  name: string,
  perUser: boolean,
  userId: string | undefined,
  ip: string,
) {
  return `${name}:${perUser && userId ? `user:${userId}` : `ip:${ip}`}`;
}

function limitExceeded(resetSeconds: number): TooManyRequestsError {
  return new TooManyRequestsError(
    "Too many requests — slow down and try again shortly.",
    resetSeconds,
  );
}

/**
 * Rate limit as a plain `beforeHandle` handler, for the routes that need it
 * (`POST /bookmarks`, `GET /share/:code`) without limiting their siblings.
 */
export function rateLimitGuard({
  name,
  limit,
  windowMs = 60_000,
  perUser = true,
  exempt = [],
}: RateLimitOptions) {
  return async (ctx: GuardContext) => {
    if (isExempt(ctx.path, exempt)) return;

    const result = consumeRateLimit(
      bucketKey(
        name,
        perUser,
        ctx.user?.id,
        clientIp(ctx.request, socketAddress(ctx.server, ctx.request)),
      ),
      limit,
      windowMs,
    );
    const resetSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));

    ctx.set.headers["x-ratelimit-limit"] = String(limit);
    ctx.set.headers["x-ratelimit-remaining"] = String(result.remaining);
    ctx.set.headers["x-ratelimit-reset"] = String(resetSeconds);

    if (!result.ok) throw limitExceeded(resetSeconds);
  };
}

/**
 * App-wide safety net. Runs at `onRequest` (before session lookup) and is
 * registered `.as("global")` so it also covers routers mounted with `.use()` —
 * without that, Elysia scopes the hook to the instance it was declared on.
 * There is no `set` this early, so the informational headers are left to the
 * per-route guards.
 */
export function globalRateLimit({
  name,
  limit,
  windowMs = 60_000,
  perUser = false,
  exempt = [],
}: RateLimitOptions) {
  return new Elysia({ name: `rate-limit:${name}` })
    .onRequest(async (ctx: RequestGuardContext) => {
      const path = new URL(ctx.request.url).pathname;
      if (isExempt(path, exempt)) return;

      const result = consumeRateLimit(
        bucketKey(
          name,
          perUser,
          undefined,
          clientIp(ctx.request, socketAddress(ctx.server, ctx.request)),
        ),
        limit,
        windowMs,
      );
      if (!result.ok) {
        throw limitExceeded(
          Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
        );
      }
    })
    .as("global");
}