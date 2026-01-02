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
import { errorPlugin } from "./error";

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
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.CLIENT_URL
          : true,
      credentials: true,
    }),
  )
  .use(errorPlugin)
  .mount(auth.handler, { prefix: "/api/auth" })
  .use(openapi({
    documentation: {
      info: {
        title: "Aggre-gator API",
        version: "1.0.0",
        description: "Bookmark management API with Better-Auth",
      },
      components: await authOpenAPI.components,
      paths: await authOpenAPI.getPaths(),
    },
    exclude: { paths: ["/api/auth/*", "/openapi/*", "/health", "/api/version"] },
  }))
  .use(bookmarksRouter)
  .use(collectionRouter)
  .use(tagsRouter)
  .use(searchRouter)
  .use(userRouter)
  .listen(process.env.PORT || 3000);
