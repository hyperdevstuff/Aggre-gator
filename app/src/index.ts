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
import { publicRouter } from "./public";
import { ogRouter } from "./og";
import { errorPlugin } from "./error";
import { globalRateLimit } from "./utils/rate-limit";
import {
  spaAssetResponse,
  spaEnabled,
  spaIndexResponse,
} from "./utils/client-spa";

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
  .get(
    "/",
    () => (spaEnabled() ? spaIndexResponse() : "Do the frontend"),
  )
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
  }));

// Single-process deployment: everything the API didn't match is the SPA.
// Specific routes (the routers below, /health, /og/*) always beat the
// catch-all; unmatched GETs get dist files or the shell.
//
// Registration order is load-bearing here, for two reasons:
//  - A no-path `.mount()` is itself an `ALL /*` route, and same-pattern routes
//    resolve in registration order — mounting first would swallow every
//    unmatched GET, so this catch-all goes first.
//  - `betterAuthPlugin` (applied by the routers below) registers its session
//    derive globally for routes registered after it — mounting auth after the
//    routers would make sign-up demand a session. So the mount goes after this
//    catch-all but before the routers.
//
// `/api/auth` is forwarded by hand because better-auth's Google callback and
// session reads are GETs that would otherwise hit this catch-all.
if (spaEnabled()) {
  app.get("/*", ({ request }) => {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/auth")) return auth.handler(request);
    return spaAssetResponse(pathname).then(
      (asset) => asset ?? spaIndexResponse(),
    );
  });
}

app
  .mount(auth.handler)
  .use(bookmarksRouter)
  .use(collectionRouter)
  .use(tagsRouter)
  .use(searchRouter)
  .use(userRouter)
  .use(shareRouter)
  .use(publicRouter)
  .use(ogRouter);

// Tests import `app` and drive it through `app.handle()`; Bun evaluates each test
// file's module graph separately, so binding a port here would make the second
// file fail with EADDRINUSE.
if (env.NODE_ENV !== "test") {
  app.listen(env.PORT);
}
