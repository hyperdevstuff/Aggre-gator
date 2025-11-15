import { Elysia, t } from "elysia";
import { auth } from "../utils/auth";
import { db } from "../db";
import { bookmarks, collections, tags } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { UnauthorizedError } from "../error";

export const userRouter = new Elysia({ prefix: "/user" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) throw new UnauthorizedError();
    return { userId: session.user.id, session };
  })
  .get("/me", async ({ session }) => {
    return session.user;
  })
  .get("/stats", async ({ userId }) => {
    const [stats] = await db
      .select({
        bookmarks: sql<number>`COUNT(DISTINCT ${bookmarks.id})::int`,
        collections: sql<number>`COUNT(DISTINCT ${collections.id})::int`,
        tags: sql<number>`COUNT(DISTINCT ${tags.id})::int`,
      })
      .from(bookmarks)
      .leftJoin(collections, eq(bookmarks.userId, collections.userId))
      .leftJoin(tags, eq(bookmarks.userId, tags.userId))
      .where(eq(bookmarks.userId, userId));
    return stats || { bookmarks: 0, collections: 0, tags: 0 };
  })

  .patch(
    "/profile",
    async ({ body, request }) => {
      const updated = await auth.api.updateUser({
        headers: request.headers,
        body: {
          name: body.name,
          image: body.image,
        },
      });
      return updated;
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        image: t.Optional(t.String({ format: "uri", maxLength: 1000 })),
      }),
    },
  );
