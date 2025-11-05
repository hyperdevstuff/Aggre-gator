import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { cors } from "@elysiajs/cors";
import { auth } from "./utils/auth";
import { bookmarksRouter } from "./bookmarks";
import { collectionRouter } from "./collections";
import { tagsRouter } from "./tags";
import { errorPlugin } from "./error";

const app = new Elysia()
  .use(
    cors({
      origin:
        process.env.NODE_ENV === "production" ? process.env.CLIENT_URL : true,
      credentials: true,
    }),
  )
  .use(errorPlugin)
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .use(bookmarksRouter)
  .use(collectionRouter)
  .use(tagsRouter)
  .get("/api/auth/session", async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return session || { user: null, session: null };
  })
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
  .listen(process.env.PORT || 3000);
