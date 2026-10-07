import { env } from "./env";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { auth } from "./utils/auth";
import { authOpenAPI } from "./utils/auth-openapi";
import { bookmarksRouter } from "./bookmarks";
import { collectionRouter } from "./collections";
import { searchRouter } from "./search";
import { tagsRouter } from "./tags";
import { userRouter } from "./user";
import { shareRouter } from "./share";
import { errorPlugin } from "./error";
import { globalRateLimit } from "./utils/rate-limit";

/** Paths that must never be rate limited: probes, docs and the auth handler. */
const UNLIMITED_PATHS = ["/health", "/api/version", "/openapi", "/api/auth"];

export const app = new Elysia()
  .get("/health", () => ({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
  }))
  .get("/api/version", () => ({
    version: "1.0.0",
    env: process.env.NODE_ENV || "development",
  }))
  .get("/", () => "Do the frontend")
  .use(
    cors({
      origin: env.NODE_ENV === "production" ? env.CLIENT_URL : true,
      credentials: true,
    }),
  )
  .use(errorPlugin)
  // Safety net for everything without a route-specific limit. High enough that
  // no normal client ever sees it, low enough to cap a runaway script.
  .use(
    globalRateLimit({
      name: "global",
      limit: 1_000,
      exempt: UNLIMITED_PATHS,
    }),
  )
  .mount(auth.handler)
  .use(openapi({
    documentation: {
      info: {
        title: "Aggre-gator API",
        version: "1.0.0",
        description: "Bookmark management API with Better-Auth",
      },
      paths: await authOpenAPI.getPaths() as any,
      components: await authOpenAPI.components as any,
    },
    exclude: { paths: ["/openapi/*", "/health", "/api/version"] },
  }))
  .use(bookmarksRouter)
  .use(collectionRouter)
  .use(tagsRouter)
  .use(searchRouter)
  .use(userRouter)
  .use(shareRouter);

// Tests import `app` and drive it through `app.handle()`; Bun evaluates each test
// file's module graph separately, so binding a port here would make the second
// file fail with EADDRINUSE.
if (env.NODE_ENV !== "test") {
  app.listen(env.PORT);
}
