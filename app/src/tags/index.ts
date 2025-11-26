import Elysia, { t } from "elysia";
import { requireAuth } from "../utils/auth";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { bookmarkTags, tags } from "../db/schema";
import { NotFoundError, ConflictError } from "../error";

export const tagsRouter = new Elysia({ prefix: "/tags" })
  .use(requireAuth)
  .post(
    "/",
    async ({ userId, body }) => {
      const [existing] = await db
        .select()
        .from(tags)
        .where(and(eq(tags.userId, userId), eq(tags.name, body.name)))
        .limit(1);

      if (existing) throw new ConflictError("tag already exists");

      const [tag] = await db
        .insert(tags)
        .values({ userId, name: body.name, color: body.color })
        .returning();

      return tag;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 50 }),
        color: t.Optional(t.String({ pattern: "^#[0-9A-Fa-f]{6}$" })),
      }),
    },
  )
  .get("/", async ({ userId }) => {
    return await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
        count:
          sql<number>`COALESCE(COUNT(${bookmarkTags.bookmarkId}), 0)::int`.as(
            "tag_count",
          ),
      })
      .from(tags)
      .leftJoin(bookmarkTags, eq(tags.id, bookmarkTags.tagId))
      .where(eq(tags.userId, userId))
      .groupBy(tags.id)
      .orderBy(sql`tag_count DESC`, tags.name);
  })
  .get(
    "/search",
    async ({ userId, query: { q } }) => {
      return await db
        .select()
        .from(tags)
        .where(
          and(
            eq(tags.userId, userId),
            sql`${tags.name} ILIKE ${"%" + q + "%"}`,
          ),
        )
        .limit(10);
    },
    {
      query: t.Object({ q: t.String({ minLength: 1, maxLength: 100 }) }),
    },
  )
  .patch(
    "/:id",
    async ({ userId, params: { id }, body }) => {
      const [updated] = await db
        .update(tags)
        .set(body)
        .where(and(eq(tags.id, id), eq(tags.userId, userId)))
        .returning();

      if (!updated) throw new NotFoundError();
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        color: t.Optional(t.String({ pattern: "^#[0-9A-Fa-f]{6}$" })),
      }),
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
