import Elysia, { t } from "elysia";
import { requireAuth } from "../utils/auth";
import { db } from "../db";
import { collections, bookmarks } from "../db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ConflictError, NotFoundError } from "../error";
import { createPaginationMeta, normalizePagination } from "../utils/pagination";

export const collectionRouter = new Elysia({ prefix: "/collections" })
  .use(requireAuth)
  .post(
    "/",
    async ({ body, userId }) => {
      const [collection] = await db
        .insert(collections)
        .values({ ...body, userId })
        .returning();
      return collection;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        parentId: t.Optional(t.String()),
      }),
    },
  )
  .get("/", async ({ userId }) => {
    return db
      .select({
        id: collections.id,
        userId: collections.userId,
        name: collections.name,
        description: collections.description,
        icon: collections.icon,
        color: collections.color,
        parentId: collections.parentId,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        bookmarkCount: sql<number>`COALESCE(COUNT(${bookmarks.id}), 0)::int`.as(
          "bookmark_count",
        ),
        isSystem: collections.isSystem,
        slug: collections.slug,
      })
      .from(collections)
      .leftJoin(bookmarks, eq(collections.id, bookmarks.collectionId))
      .where(and(eq(collections.userId, userId), isNull(collections.parentId)))
      .groupBy(collections.id);
  })
  .get("/:id", async ({ params: { id }, userId }) => {
    const [col] = await db
      .select({
        id: collections.id,
        userId: collections.userId,
        name: collections.name,
        description: collections.description,
        icon: collections.icon,
        color: collections.color,
        parentId: collections.parentId,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        bookmarkCount: sql<number>`COALESCE(COUNT(${bookmarks.id}), 0)::int`.as(
          "bookmark_count",
        ),
      })
      .from(collections)
      .leftJoin(bookmarks, eq(collections.id, bookmarks.collectionId))
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .groupBy(collections.id)
      .limit(1);
    if (!col) throw new NotFoundError();
    return col;
  })
  .patch(
    "/:id",
    async ({ params: { id }, userId, body }) => {
      const [existing] = await db
        .select({
          isSystem: collections.isSystem,
        })
        .from(collections)
        .where(and(eq(collections.id, id), eq(collections.userId, userId)))
        .limit(1);
      if (!existing) throw new NotFoundError();
      if (existing.isSystem && (body.name || body.slug))
        throw new ConflictError("cannot update system collection");

      const [col] = await db
        .update(collections)
        .set(body)
        .where(and(eq(collections.id, id), eq(collections.userId, userId)))
        .returning();
      if (!col) throw new NotFoundError();
      return col;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        slug: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        description: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        color: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params: { id }, userId }) => {
      const [col] = await db
        .delete(collections)
        .where(and(eq(collections.id, id), eq(collections.userId, userId)))
        .returning();
      if (!col) throw new NotFoundError();
      if (col.isSystem)
        throw new ConflictError("cannot delete system collection");
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get(
    "/:id/bookmarks",
    async ({ params: { id }, userId, query }) => {
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      const conditions = [
        eq(bookmarks.userId, userId),
        eq(bookmarks.collectionId, id),
      ];

      const [data, [{ count }]] = await Promise.all([
        db
          .select()
          .from(bookmarks)
          .where(and(...conditions))
          .orderBy(desc(bookmarks.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(bookmarks)
          .where(and(...conditions)),
      ]);

      return {
        data,
        pagination: createPaginationMeta(page, limit, Number(count)),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1 })),
      }),
    },
  )
  .get("/:id/children", async ({ params: { id }, userId }) => {
    return db
      .select({
        id: collections.id,
        userId: collections.userId,
        name: collections.name,
        description: collections.description,
        icon: collections.icon,
        color: collections.color,
        parentId: collections.parentId,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        bookmarkCount: sql<number>`COALESCE(COUNT(${bookmarks.id}), 0)::int`.as(
          "bookmark_count",
        ),
      })
      .from(collections)
      .leftJoin(bookmarks, eq(collections.id, bookmarks.collectionId))
      .where(and(eq(collections.userId, userId), eq(collections.parentId, id)))
      .groupBy(collections.id);
  })
  .get("/by-slug/:slug", async ({ params: { slug }, userId }) => {
    const [col] = await db
      .select({
        id: collections.id,
        userId: collections.userId,
        name: collections.name,
        description: collections.description,
        icon: collections.icon,
        color: collections.color,
        parentId: collections.parentId,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        isSystem: collections.isSystem,
        slug: collections.slug,
        bookmarkCount: sql<number>`COALESCE(COUNT(${bookmarks.id}), 0)::int`.as(
          "bookmark_count",
        ),
      })
      .from(collections)
      .leftJoin(bookmarks, eq(collections.id, bookmarks.collectionId))
      .where(and(eq(collections.userId, userId), eq(collections.slug, slug)))
      .groupBy(collections.id)
      .limit(1);
    if (!col) throw new NotFoundError();
    return col;
  });
