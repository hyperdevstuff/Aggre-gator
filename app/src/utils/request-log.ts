/**
 * Structured request logging with a propagated request id.
 *
 * Two jobs, one log line per request:
 *
 *  1. **Traceability.** Every response carries `x-request-id`, taken from the
 *     caller's `x-request-id` when they send one and generated otherwise. That
 *     makes a single user-reported failure ("my save didn't get a cover at
 *     14:03") greppable across the API, the job queue, and any downstream log.
 *  2. **Timing.** `durationMs` per request, which is how you find the slow
 *     endpoint instead of guessing.
 *
 * Registered `.as("global")` for the same reason as `globalRateLimit`: without
 * it Elysia scopes the hooks to the instance they are declared on, and every
 * router mounted with `.use()` would go unlogged.
 *
 * Log lines go to stdout as one JSON object each, because that is what Render
 * aggregates — a pretty multi-line format would be unreadable there.
 */
import { Elysia } from "elysia";
import { nanoid } from "nanoid";

/**
 * Request ids are echoed into a response header and printed in logs, so they are
 * attacker-controlled. Anything outside this alphabet is dropped rather than
 * sanitized: an id is machine-generated, and a caller sending a newline or a
 * 4KB string is either broken or probing the logs. Rejecting outright also
 * means a forged id cannot be crafted to collide with a real one in a grep.
 */
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

const MAX_PATH_LENGTH = 200;
/** Bound the error text so one enormous upstream message cannot flood the log. */
const MAX_ERROR_LENGTH = 500;

/**
 * Generate a request id.
 *
 * 16 chars of nanoid's default alphabet — collision-safe for the volume here,
 * and short enough to read out loud over a call.
 */
function generateRequestId() {
  return nanoid(16);
}

/**
 * The id to use for this request: the caller's if it is well-formed, else a new
 * one. An unrecognised inbound id is dropped rather than passed through, so a
 * caller cannot inject newlines into the log stream or forge an id.
 */
export function resolveRequestId(inbound: string | null | undefined) {
  if (inbound && VALID_REQUEST_ID.test(inbound)) return inbound;
  return generateRequestId();
}

/**
 * Paths that are not logged.
 *
 * `/health` is exempt, not because it is uninteresting (a failing probe is
 * exactly what you want a request-id for) but because uptime monitors poll it
 * every 30s and those lines bury real traffic. It still responds with its own
 * request-id — the header is unconditional, only the log line is skipped.
 *
 * Matching is exact or prefix-at-a-slash, so `/healthcheck` is not swept up by a
 * rule meant for `/health`.
 */
const UNLOGGED_PATHS = ["/health", "/favicon.ico"];

/** Whether this path is exempt from logging. */
export function isUnloggedPath(path: string) {
  return UNLOGGED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * The subset of an Elysia context this plugin reads.
 *
 * Structural rather than Elysia's inferred context type on purpose: the same
 * functions are called from `onRequest`, `onAfterHandle` and `onError`, whose
 * real context types differ (`error` exists only on the last, `set.headers` is
 * absent on the first), and the hooks themselves take `any` at the boundary.
 */
/*
 * Two Elysia behaviours this plugin has to work around are written up in
 * `ELYSIA-NOTES.md` beside this file:
 *  - `.use()` order is registration order; hooks only cover later routes.
 *  - `.error({ Class })` handlers beat any `onError`, including this one.
 * Read that before changing anything about the error paths here.
 */

export type RequestLogContext = {
  request: Request;
  set?: { status?: number; headers?: Record<string, string | number | undefined> };
  /** Populated by `betterAuthPlugin` on routes registered after it. */
  user?: { id?: string };
  store: { requestId?: string; startTime?: number };
  /** Elysia provides `error` only on the error path. */
  error?: unknown;
  code?: number;
};

/** Milliseconds since an arbitrary origin; monotonic enough for a duration. */
function nowMs() {
  return performance.now();
}

function emit(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}

/**
 * Emit the log line for a finished request.
 *
 * Exported so tests can assert on the shape without scraping stdout, and so both
 * `onAfterHandle` and `onError` produce exactly one line through one code path —
 * the difference between "a 500 was logged" and "a 500 was logged differently"
 * is the kind of thing that silently rots.
 */
export function logRequest(
  ctx: RequestLogContext,
  outcome: { status?: number; durationMs: number; error?: unknown },
) {
  const url = new URL(ctx.request.url);
  const path = url.pathname.slice(0, MAX_PATH_LENGTH);
  if (isUnloggedPath(path)) return;

  const status = outcome.status ?? 0;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  // The query string is deliberately never logged: share codes and password
  // reset tokens travel in URLs, and this log is not the place for them.
  const entry: Record<string, unknown> = {
    level,
    method: ctx.request.method,
    path,
    status,
    durationMs: Math.round(outcome.durationMs),
    requestId: ctx.store.requestId,
  };

  if (ctx.user?.id) entry.userId = ctx.user.id;
  if (outcome.error) {
    const err = outcome.error;
    entry.error =
      err instanceof Error
        ? (err.message ?? "").slice(0, MAX_ERROR_LENGTH)
        : String(err).slice(0, MAX_ERROR_LENGTH);
    // Only the message is logged, never the stack: it carries absolute paths
    // and is far too long for a single JSON line at 500+ frequency.
  }

  emit(entry);
}

/**
 * The plugin.
 *
 * `onRequest` assigns the id and starts the clock. `onAfterHandle` and
 * `onError` are both needed: an error path never reaches `afterHandle`, so
 * without `onError` the one request you most want would be the one missing —
 * a 500 logging nothing is exactly backwards.
 *
 * Registration order matters. This must be `.use()`d *before*
 * `globalRateLimit`, which throws from its own `onRequest`: a request rejected
 * by the limiter would otherwise log with no id assigned, losing the request-id
 * on precisely the flood traffic you most want to identify.
 */
// The hook boundaries take `any` deliberately. Elysia infers a different context
// type for each lifecycle point (`error` exists only on `onError`, `set.headers`
// is absent on `onRequest`), and none of them structurally match a single
// declared parameter — but the three hooks all provide this superset of fields.
export const requestLogger = new Elysia({ name: "request-logger" })
  .onRequest((ctx: any) => {
    ctx.store.requestId = resolveRequestId(ctx.request.headers.get("x-request-id"));
    ctx.store.startTime = nowMs();
  })
  .onAfterHandle((ctx: any) => {
    // `set.headers` is unavailable on `onRequest`, so the response header is
    // attached here and in `onError` — a request that fails partway through must
    // still carry its id, or the response you are debugging has nothing to grep.
    attachRequestId(ctx);
    logRequest(ctx, {
      status: ctx.set?.status ?? ctx.code ?? 200,
      durationMs: nowMs() - (ctx.store.startTime ?? nowMs()),
    });
  })
  .onError((ctx: any) => {
    attachRequestId(ctx);
    logRequest(ctx, {
      status: ctx.set?.status ?? 500,
      durationMs: nowMs() - (ctx.store.startTime ?? nowMs()),
      error: ctx.error,
    });
  })
  .as("global");

/**
 * Whether `set.headers` still carries the id.
 *
 * Elysia's `handleSet` converts `set.headers` into a `Headers` instance partway
 * through response mapping, so the id can be found under either representation.
 */
function hasRequestId(headers: unknown) {
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has("x-request-id");
  try {
    return new Headers(headers as HeadersInit).has("x-request-id");
  } catch {
    return false;
  }
}

/** Assign the id to `set.headers`, whichever representation is in use. */
export function attachRequestId(ctx: RequestLogContext) {
  const id = ctx.store?.requestId;
  if (!id || !ctx.set) return;
  if (hasRequestId(ctx.set.headers)) return;

  if (ctx.set.headers instanceof Headers) {
    ctx.set.headers.set("x-request-id", id);
    return;
  }
  ctx.set.headers = { ...(ctx.set.headers ?? {}), "x-request-id": id };
}