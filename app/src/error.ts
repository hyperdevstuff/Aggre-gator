import { Elysia } from "elysia";

class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
  ) {
    super(message);
  }

  toResponse() {
    return new Response(JSON.stringify({ error: this.message }), {
      status: this.status,
      headers: { "Content-Type": "application/json" },
    });
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
  constructor(message = "Resource already exists") {
    super(409, message);
  }
}

export const errorPlugin = new Elysia({ name: "error-handler" })
  .error({
    UnauthorizedError,
    NotFoundError,
    ConflictError,
  })
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400; // Bad Request
      return {
        error: "Validation Failed",
        details: error.all.map((e) => ({
          message: e.summary,
        })),
      };
    }

    if (error instanceof ApiError) {
      return error.toResponse();
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Route not found" };
    }

    console.error("[Unhandled Error]", error); // Log it for debugging
    set.status = 500;
    return { error: "Internal Server Error" };
  });
