import { and, eq, sql } from "drizzle-orm";
import Elysia, { NotFoundError, t } from "elysia";
import { db } from "../db";
import { bookmarks, tags, bookmarkTags } from "../db/schema";
import { ConflictError } from "../error";
import { betterAuthPlugin } from "../utils/auth";
import {
  getBookmarkCollectionIds,
  setBookmarkCollections,
} from "../utils/collections";

export const bookmarksIdRouter = new Elysia()
  .use(betterAuthPlugin)
  .get(
    "/:id",
    async ({ params: { id }, user }) => {
      const userId = user.id;
      const [bookmark] = await db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .limit(1);

      if (!bookmark) throw new NotFoundError();
      const bookmarkTag = await db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(bookmarkTags)
        .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
        .where(eq(bookmarkTags.bookmarkId, id));
      const memberships = await getBookmarkCollectionIds(db, [id]);
      return {
        ...bookmark,
        collectionIds: memberships.get(id) ?? [],
        tags: bookmarkTag,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params: { id }, body, user }) => {
      const userId = user.id;
      const { tags: tagNames, collectionIds, ...updateData } = body;

      if (updateData.url) {
        const [existing] = await db
          .select()
          .from(bookmarks)
          .where(
            and(
              eq(bookmarks.userId, userId),
              eq(bookmarks.url, updateData.url),
              sql`${bookmarks.id} != ${id}`,
            ),
          )
          .limit(1);

        if (existing) throw new ConflictError();
      }
      // A bookmark must never be filed into another user's collection; an
      // empty array means unfiled. `setBookmarkCollections` validates ownership.
      // Only touch the row when there are scalar fields to change, so a
      // membership-only PATCH does not run an empty UPDATE.
      let bookmark: typeof bookmarks.$inferSelect | undefined;
      if (Object.keys(updateData).length > 0) {
        [bookmark] = await db
          .update(bookmarks)
          .set(updateData)
          .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
          .returning();
      } else {
        [bookmark] = await db
          .select()
          .from(bookmarks)
          .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
          .limit(1);
      }

      if (!bookmark) throw new NotFoundError();

      if (collectionIds !== undefined) {
        await setBookmarkCollections(db, userId, id, collectionIds);
      }

      if (tagNames !== undefined) {
        await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, id));

        if (tagNames.length > 0) {
          const tagIds = await Promise.all(
            tagNames.map(async (name: string) => {
              let [tag] = await db
                .select()
                .from(tags)
                .where(and(eq(tags.userId, userId), eq(tags.name, name)))
                .limit(1);

              if (!tag) {
                [tag] = await db
                  .insert(tags)
                  .values({ userId, name })
                  .returning();
              }

              return tag.id;
            }),
          );

          await db
            .insert(bookmarkTags)
            .values(tagIds.map((tagId: string) => ({ bookmarkId: id, tagId })));
        }
      }

      const memberships = await getBookmarkCollectionIds(db, [id]);
      return { ...bookmark, collectionIds: memberships.get(id) ?? [] };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
        url: t.Optional(t.String({ format: "uri" })),
        description: t.Optional(t.String({ maxLength: 2000 })),
        note: t.Optional(t.String({ maxLength: 5000 })),
        cover: t.Optional(t.String({ format: "uri", maxLength: 1000 })),
        isFavorite: t.Optional(t.Boolean()),
        collectionIds: t.Optional(t.Array(t.String())),
        tags: t.Optional(t.Array(t.String())),
      }),
    },
  )
  .post(
    "/:id/archive",
    async ({ params: { id }, user }) => {
      const userId = user.id;
      // Archiving is a flag, not a move: the bookmark keeps its collection so
      // restoring it later puts it back where it was.
      const [bookmark] = await db
        .update(bookmarks)
        .set({ archivedAt: new Date() })
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .returning();

      if (!bookmark) throw new NotFoundError();

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/unarchive",
    async ({ params: { id }, user }) => {
      const userId = user.id;
      const [bookmark] = await db
        .update(bookmarks)
        .set({ archivedAt: null })
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .returning();

      if (!bookmark) throw new NotFoundError();

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/:id",
    async ({ params: { id }, user }) => {
      const userId = user.id;
      const [bookmark] = await db
        .select({ archivedAt: bookmarks.archivedAt })
        .from(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .limit(1);

      if (!bookmark) throw new NotFoundError();
      if (bookmark.archivedAt == null) {
        throw new ConflictError("Bookmark should be archived first");
      }
      await db.delete(bookmarks).where(eq(bookmarks.id, id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
