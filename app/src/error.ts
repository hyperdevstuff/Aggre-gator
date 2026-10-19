import { Elysia } from "elysia";
import {
  attachRequestId,
  logRequest,
  type RequestLogContext,
} from "./utils/request-log";

class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: unknown,
    /**
     * Stable machine-readable code, emitted as `code` alongside `error`.
     *
     * Added because some failures are states rather than mistakes: the client
     * has to react differently to "verify your email and retry" than to "that
     * slug is taken", and it cannot do that by pattern-matching prose. Additive,
     * so every existing consumer of `{ error }` keeps working untouched.
     */
    public code?: string,
  ) {
    super(message);
  }

  toResponse() {
    return new Response(
      JSON.stringify({
        error: this.message,
        ...(this.code ? { code: this.code } : {}),
        ...(this.details !== undefined ? { details: this.details } : {}),
      }),
      {
        status: this.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not Found") {
    super(404, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Resource already exists", details?: unknown) {
    super(409, message, details);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden", details?: unknown, code?: string) {
    super(403, message, details, code);
  }
}

/**
 * The account is real, signed in, and fully usable — it just may not *publish*
 * yet. `be-07`, and the reason this is a 403 rather than a 401: nothing about
 * the session is wrong, and re-authenticating does not help.
 *
 * `details` carries what the client needs to act rather than to display: the
 * current flag, and the endpoint that sends a fresh link.
 */
export class EmailVerificationRequiredError extends ForbiddenError {
  constructor() {
    super(
      "Verify your email address to publish.",
      {
        emailVerified: false,
        resendVerificationUrl: "/api/auth/send-verification-email",
      },
      "EMAIL_NOT_VERIFIED",
    );
  }
}

export class GoneError extends ApiError {
  constructor(message = "This resource is no longer available") {
    super(410, message);
  }
}

export class TooManyRequestsError extends ApiError {
  /** Seconds the caller should wait before retrying (sets `Retry-After`). */
  constructor(
    message = "Too many requests",
    public retryAfterSeconds = 60,
  ) {
    super(429, message);
  }

  override toResponse() {
    const response = super.toResponse();
    response.headers.set("Retry-After", String(this.retryAfterSeconds));
    return response;
  }
}

export class InternalError extends ApiError {
  constructor(message = "Internal Server Error") {
    super(500, message);
  }
}

export const errorPlugin = new Elysia({ name: "error-handler" })
  // Deliberately *not* exhaustive. A new `ApiError` subclass only needs to be
  // listed here if it needs different handling; otherwise the `instanceof
  // ApiError` branch of `onError` below produces the same response, attaches the
  // request id and logs it — which is exactly what ELYSIA-NOTES warns a per-class
  // handler silently skips. `EmailVerificationRequiredError` relies on that.
  .error({
    UnauthorizedError,
    NotFoundError,
    ConflictError,
    ForbiddenError,
    GoneError,
    TooManyRequestsError,
    InternalError,
  })
  .onError((ctx: any) => {
    const { code, error, set } = ctx;
    // Typed as `any` at the boundary because this plugin must also see contexts
    // Elysia does not narrow here — notably `store`, which carries the
    // request-id assigned by the request logger's `onRequest`.

    // Every error response is logged and gets an `x-request-id`. This has to be
    // here rather than only in the logger's own `onError` because Elysia gives
    // `.error({ Class })` handlers precedence over `onError` — so for the
    // registered `ApiError` subclasses below, the logger's hook never runs.
    if (code === "VALIDATION") {
      set.status = 400; // Bad Request
      attachRequestId(ctx as RequestLogContext);
      logRequest(ctx, { status: 400, durationMs: 0, error: "Validation Failed" });
      return {
        error: "Validation Failed",
        details: error.all.map((e: { summary?: string }) => ({
          message: e.summary,
        })),
      };
    }

    if (error instanceof ApiError) {
      // Two things are needed here, and both are consequences of how Elysia
      // dispatches errors:
      //
      //  1. `.error({ ApiErrorSubclass })` registers a *per-class* handler, and
      //     that takes precedence over any `onError` — so the request logger's
      //     `onError` never runs for these, and it never got the chance to put
      //     `x-request-id` in `set.headers`. Attach it here instead, or every
      //     401/404/409 response would arrive with no id to report.
      //  2. `toResponse()` builds a brand-new `Response`, which discards
      //     `set.headers` wholesale. Copy them across so the id (and anything
      //     else a plugin attached) survives. `Retry-After` is already on the
      //     Response itself, hence the "don't clobber" guard.
      attachRequestId(ctx as RequestLogContext);
      logRequest(ctx, { status: error.status, durationMs: 0, error: error.message });
      const response = error.toResponse();
      const headers = set?.headers;
      if (headers) {
        const entries =
          headers instanceof Headers
            ? [...headers.entries()]
            : Object.entries(headers as Record<string, string>);
        for (const [key, value] of entries) {
          if (value != null && !response.headers.has(key)) {
            response.headers.set(key, String(value));
          }
        }
      }
      return response;
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      attachRequestId(ctx as RequestLogContext);
      logRequest(ctx, { status: 404, durationMs: 0, error: "Route not found" });
      return { error: "Route not found" };
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("[Unhandled Error]", error);
    }

    set.status = 500;
    // The catch-all: nothing recognised this error, so it is a bug. Attach the
    // id and log it at `error` level — this is the line that makes a production
    // 500 reportable.
    attachRequestId(ctx as RequestLogContext);
    logRequest(ctx, { status: 500, durationMs: 0, error });
    return { error: "Internal Server Error" };
  })
  // Without a global scope this plugin's onError only applies to its own
  // (empty) instance, so validation failures leak Elysia's raw 422 shape.
  .as("global");
