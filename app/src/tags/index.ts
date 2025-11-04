import Elysia, { t } from "elysia";
import { auth } from "../utils/auth";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { bookmarkTags, tags } from "../db/schema";
import { UnauthorizedError, NotFoundError } from "../error";

export const tagsRouter = new Elysia({ prefix: "/tags" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) throw new UnauthorizedError();
    return { userId: session.user.id };
  })
  .get("/", async ({ userId }) => {
    return await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
        count: sql<number>`COALESCE(COUNT(${bookmarkTags.bookmarkId}), 0)::int`,
      })
      .from(tags)
      .leftJoin(bookmarkTags, eq(tags.id, bookmarkTags.tagId))
      .where(eq(tags.userId, userId))
      .groupBy(tags.id)
      .orderBy(sql`count DESC, ${tags.name}`);
  })
  .get(
    "/search",
    async ({ userId, query: { q } }) => {
      if (!q || q.length < 1) return [];
      const result = db
        .select()
        .from(tags)
        .where(
          and(
            eq(tags.userId, userId),
            sql`${tags.name} ILIKE ${"%" + q + "%"}`,
          ),
        )
        .limit(10);
      return await result;
    },
    {
      query: t.Object({ q: t.String({ minLength: 1, maxLength: 100 }) }), // typesafe bros
    },
  )
  .delete(
    "/:id",
    async ({ userId, params: { id } }) => {
      const [deleted] = await db
        .delete(tags)
        .where(and(eq(tags.id, id), eq(tags.userId, userId)))
        .returning();
      if (!deleted) throw new NotFoundError();
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
