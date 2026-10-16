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
  ) {
    super(message);
  }

  toResponse() {
    return new Response(
      JSON.stringify({
        error: this.message,
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
  constructor(message = "Forbidden") {
    super(403, message);
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
