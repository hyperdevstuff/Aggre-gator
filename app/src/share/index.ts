import { Elysia, t } from "elysia";
import { db } from "../db";
import {
  sharedCollections,
  collections,
  bookmarks,
  bookmarkTags,
  tags,
  user,
} from "../db/schema";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { GoneError, NotFoundError } from "../error";
import { createPaginationMeta, normalizePagination } from "../utils/pagination";

/**
 * Recursively collect all descendant collection IDs
 * (the shared collection + all its nested children at any depth).
 */
async function getAllCollectionIds(
  collectionId: string,
  userId: string,
): Promise<string[]> {
  const children = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.userId, userId),
        eq(collections.parentId, collectionId),
      ),
    );

  const childIds = children.map((c) => c.id);
  const deeperIds = await Promise.all(
    childIds.map((id) => getAllCollectionIds(id, userId)),
  );

  return [collectionId, ...childIds, ...deeperIds.flat()];
}

export const shareRouter = new Elysia({ prefix: "/share" })
  // No betterAuthPlugin — this is a public endpoint
  .get(
    "/:code",
    async ({ params: { code }, query }) => {
      // find the share
      const [share] = await db
        .select({
          id: sharedCollections.id,
          userId: sharedCollections.userId,
          collectionId: sharedCollections.collectionId,
          isActive: sharedCollections.isActive,
          createdAt: sharedCollections.createdAt,
        })
        .from(sharedCollections)
        .where(eq(sharedCollections.shareCode, code))
        .limit(1);

      if (!share) throw new NotFoundError("share link not found");
      if (!share.isActive) throw new GoneError("this share link is no longer active");

      // get the collection
      const [col] = await db
        .select({
          id: collections.id,
          name: collections.name,
          description: collections.description,
          icon: collections.icon,
          color: collections.color,
        })
        .from(collections)
        .where(eq(collections.id, share.collectionId))
        .limit(1);

      if (!col) throw new NotFoundError("collection not found");

      // get the sharing user's name
      const [sharer] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, share.userId))
        .limit(1);

      // get all collection IDs (this collection + all nested children)
      const allCollectionIds = await getAllCollectionIds(
        share.collectionId,
        share.userId,
      );

      // get nested collections info (excluding the root one)
      const nestedCollections =
        allCollectionIds.length > 1
          ? await db
              .select({
                id: collections.id,
                name: collections.name,
                icon: collections.icon,
                color: collections.color,
                bookmarkCount:
                  sql<number>`COALESCE(COUNT(${bookmarks.id}), 0)::int`.as(
                    "bookmark_count",
                  ),
              })
              .from(collections)
              .leftJoin(
                bookmarks,
                eq(collections.id, bookmarks.collectionId),
              )
              .where(
                inArray(
                  collections.id,
                  allCollectionIds.filter((id) => id !== share.collectionId),
                ),
              )
              .groupBy(collections.id)
          : [];

      // paginate bookmarks across all collections
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      const conditions = [inArray(bookmarks.collectionId, allCollectionIds)];

      const [bookmarksData, [{ count }]] = await Promise.all([
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

      // fetch tags for the bookmarks
      const bookmarkIds = bookmarksData.map((b) => b.id);
      const tagsData =
        bookmarkIds.length > 0
          ? await db
              .select({
                bookmarkId: bookmarkTags.bookmarkId,
                tagId: tags.id,
                tagName: tags.name,
                tagColor: tags.color,
              })
              .from(bookmarkTags)
              .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
              .where(inArray(bookmarkTags.bookmarkId, bookmarkIds))
          : [];

      const tagsByBookmark = tagsData.reduce(
        (acc, t) => {
          if (!acc[t.bookmarkId]) acc[t.bookmarkId] = [];
          acc[t.bookmarkId].push({
            id: t.tagId,
            name: t.tagName,
            color: t.tagColor,
          });
          return acc;
        },
        {} as Record<
          string,
          Array<{ id: string; name: string; color: string | null }>
        >,
      );

      const bookmarksWithTags = bookmarksData.map((bookmark) => ({
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description,
        cover: bookmark.cover,
        domain: bookmark.domain,
        isFavorite: bookmark.isFavorite,
        createdAt: bookmark.createdAt,
        tags: tagsByBookmark[bookmark.id] || [],
      }));

      return {
        collection: col,
        sharedBy: sharer?.name || "Unknown",
        sharedAt: share.createdAt,
        bookmarks: {
          data: bookmarksWithTags,
          pagination: createPaginationMeta(page, limit, Number(count)),
        },
        nestedCollections,
      };
    },
    {
      params: t.Object({ code: t.String() }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1 })),
      }),
    },
  );
