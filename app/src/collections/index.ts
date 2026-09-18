import Elysia, { t } from "elysia";
import { betterAuthPlugin } from "../utils/auth";
import { db } from "../db";
import { collections, bookmarks, sharedCollections, user as users } from "../db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ConflictError, ForbiddenError, NotFoundError } from "../error";
import { generateShareCode } from "../utils/nanoid";
import { createPaginationMeta, normalizePagination } from "../utils/pagination";

import { collectionParentError } from "../../../shared/collection-tree";
import { getSystemCollectionId } from "../utils/collections";

export const collectionRouter = new Elysia({ prefix: "/collections" })
  .use(betterAuthPlugin)
  .post(
    "/",
    async ({ body, user }) => {
      const userId = user.id;
      return db.transaction(async (tx) => {
        // Serialize hierarchy writes per owner so concurrent moves cannot
        // each pass validation against an outdated tree.
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
        const nodes = await tx.select().from(collections).where(eq(collections.userId, userId));
        const error = collectionParentError(nodes, body.parentId ?? null);
        if (error) throw new ConflictError(error);
        const [collection] = await tx.insert(collections).values({ ...body, userId }).returning();
        return collection;
      });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        color: t.Optional(t.String()),
        parentId: t.Optional(t.String({ minLength: 1 })),
      }),
    },
  )
  .get("/", async ({ user }) => {
    const userId = user.id;
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
      .where(eq(collections.userId, userId))
      .groupBy(collections.id)
      .orderBy(asc(collections.createdAt));
  })
  .get("/:id", async ({ params: { id }, user }) => {
    const userId = user.id;
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
    async ({ params: { id }, user, body }) => {
      const userId = user.id;
      return db.transaction(async (tx) => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
        const nodes = await tx.select().from(collections).where(eq(collections.userId, userId));
        const existing = nodes.find((node) => node.id === id);
        if (!existing) throw new NotFoundError();
        if (existing.isSystem && (body.name || body.slug || body.parentId !== undefined))
          throw new ConflictError("cannot update system collection");
        if (body.parentId !== undefined) {
          const error = collectionParentError(nodes, body.parentId, id);
          if (error) throw new ConflictError(error);
        }
        const [col] = await tx.update(collections).set(body)
          .where(and(eq(collections.id, id), eq(collections.userId, userId))).returning();
        return col;
      });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        slug: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        description: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        color: t.Optional(t.String()),
        parentId: t.Optional(t.Union([t.String({ minLength: 1 }), t.Null()])),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params: { id }, user, query }) => {
      const userId = user.id;
      // Explicit opt-in to destroy the bookmarks as well. Accepts boolean
      // true or the string "true" (query-string form).
      const deleteBookmarks =
        query?.deleteBookmarks === true || query?.deleteBookmarks === "true";
      return db.transaction(async (tx) => {
        // Serialize hierarchy writes per owner so a concurrent move cannot
        // slip a child under a collection mid-delete.
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
        // Check before deleting — deleting first would remove a system
        // collection before the ConflictError below could stop it.
        const [col] = await tx
          .select({ id: collections.id, isSystem: collections.isSystem })
          .from(collections)
          .where(and(eq(collections.id, id), eq(collections.userId, userId)))
          .limit(1);
        if (!col) throw new NotFoundError();
        if (col.isSystem)
          throw new ConflictError("cannot delete system collection");

        // Deleting a parent must not silently dump children to top level
        // (parentId FK is onDelete: set null) — block and let the client
        // move or delete the subtree first.
        const children = await tx
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.userId, userId),
              eq(collections.parentId, col.id),
            ),
          );
        if (children.length > 0)
          throw new ConflictError(
            "Collection has sub-collections. Move or delete them first.",
            {
              childCount: children.length,
              childIds: children.map((c) => c.id),
            },
          );

        if (deleteBookmarks) {
          const deleted = await tx
            .delete(bookmarks)
            .where(
              and(
                eq(bookmarks.userId, userId),
                eq(bookmarks.collectionId, col.id),
              ),
            )
            .returning({ id: bookmarks.id });
          await tx.delete(collections).where(eq(collections.id, col.id));
          return { success: true, movedBookmarks: 0, deletedBookmarks: deleted.length };
        }

        // Default: keep the bookmarks, re-homed to Unsorted. A plain
        // collection delete must never produce collectionId = NULL orphans
        // (they fall out of every listing — NULL != archivedId is not true).
        const unsortedId = await getSystemCollectionId(tx, userId, "unsorted");
        if (!unsortedId)
          throw new NotFoundError("unsorted collection not found");
        const moved = await tx
          .update(bookmarks)
          .set({ collectionId: unsortedId })
          .where(
            and(
              eq(bookmarks.userId, userId),
              eq(bookmarks.collectionId, col.id),
            ),
          )
          .returning({ id: bookmarks.id });
        await tx.delete(collections).where(eq(collections.id, col.id));
        // Shared links cascade off the collection FK — no code needed.
        return { success: true, movedBookmarks: moved.length, deletedBookmarks: 0 };
      });
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        deleteBookmarks: t.Optional(t.Union([t.Boolean(), t.String()])),
      }),
    },
  )
  .get(
    "/:id/bookmarks",
    async ({ params: { id }, user, query }) => {
      const userId = user.id;
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
  .get("/:id/children", async ({ params: { id }, user }) => {
    const userId = user.id;
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
      .groupBy(collections.id)
      .orderBy(asc(collections.createdAt));
  })
  .get("/by-slug/:slug", async ({ params: { slug }, user }) => {
    const userId = user.id;
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
  })
  // === SHARE MANAGEMENT ===
  .post(
    "/:id/share",
    async ({ params: { id }, user }) => {
      const userId = user.id;

      // verify collection exists and belongs to user
      const [col] = await db
        .select({
          id: collections.id,
          isSystem: collections.isSystem,
        })
        .from(collections)
        .where(and(eq(collections.id, id), eq(collections.userId, userId)))
        .limit(1);

      if (!col) throw new NotFoundError();
      if (col.isSystem) throw new ForbiddenError("cannot share system collections");

      // check if already shared — return existing
      const [existing] = await db
        .select()
        .from(sharedCollections)
        .where(
          and(
            eq(sharedCollections.collectionId, id),
            eq(sharedCollections.userId, userId),
          ),
        )
        .limit(1);

      if (existing) {
        // re-activate if it was deactivated
        if (!existing.isActive) {
          await db
            .update(sharedCollections)
            .set({ isActive: true })
            .where(eq(sharedCollections.id, existing.id));
        }
        return {
          id: existing.id,
          shareCode: existing.shareCode,
          isActive: true,
          createdAt: existing.createdAt,
        };
      }

      // create new share
      const shareCode = generateShareCode();
      const [share] = await db
        .insert(sharedCollections)
        .values({
          userId,
          collectionId: id,
          shareCode,
        })
        .returning();

      return {
        id: share.id,
        shareCode: share.shareCode,
        isActive: share.isActive,
        createdAt: share.createdAt,
      };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get(
    "/:id/share",
    async ({ params: { id }, user }) => {
      const userId = user.id;

      const [share] = await db
        .select()
        .from(sharedCollections)
        .where(
          and(
            eq(sharedCollections.collectionId, id),
            eq(sharedCollections.userId, userId),
          ),
        )
        .limit(1);

      if (!share || !share.isActive) return null;

      return {
        id: share.id,
        shareCode: share.shareCode,
        isActive: share.isActive,
        createdAt: share.createdAt,
      };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/:id/share",
    async ({ params: { id }, user }) => {
      const userId = user.id;

      const [share] = await db
        .update(sharedCollections)
        .set({ isActive: false })
        .where(
          and(
            eq(sharedCollections.collectionId, id),
            eq(sharedCollections.userId, userId),
          ),
        )
        .returning();

      if (!share) throw new NotFoundError("no share found for this collection");

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
