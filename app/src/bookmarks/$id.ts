import { and, eq, sql } from "drizzle-orm";
import Elysia, { NotFoundError, t } from "elysia";
import { db } from "../db";
import { bookmarks, tags, bookmarkTags, collections } from "../db/schema";
import { ConflictError } from "../error";
import { requireAuth } from "../utils/auth";

export const bookmarksIdRouter = new Elysia({ prefix: "/bookmarks" })
  .use(requireAuth)
  .get(
    "/:id",
    async ({ params: { id }, userId }) => {
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
      return { ...bookmark, tags: bookmarkTag };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params: { id }, body, userId }) => {
      const { tags: tagNames, ...updateData } = body;

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
      const [bookmark] = await db
        .update(bookmarks)
        .set(updateData)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .returning();

      if (!bookmark) throw new NotFoundError();

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

      return bookmark;
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
        collectionId: t.Optional(t.Union([t.String(), t.Null()])),
        tags: t.Optional(t.Array(t.String())),
      }),
    },
  )
  .post(
    "/:id/archive",
    async ({ params: { id }, userId }) => {
      const archivedId = (
        await db
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.userId, userId),
              eq(collections.slug, "archived"),
            ),
          )
          .limit(1)
      )[0]?.id;

      if (!archivedId) throw new NotFoundError("archived collection not found");

      const [bookmark] = await db
        .update(bookmarks)
        .set({ collectionId: archivedId })
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
    async ({ params: { id }, userId }) => {
      const unsortedId = (
        await db
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.userId, userId),
              eq(collections.slug, "unsorted"),
            ),
          )
          .limit(1)
      )[0]?.id;

      if (!unsortedId) throw new NotFoundError("unsorted collection not found");

      const [bookmark] = await db
        .update(bookmarks)
        .set({ collectionId: unsortedId })
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
    async ({ params: { id }, userId }) => {
      const archivedId = (
        await db
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.userId, userId),
              eq(collections.slug, "archived"),
            ),
          )
          .limit(1)
      )[0]?.id;

      if (!archivedId) {
        throw new NotFoundError("Archieved Collection not Found");
      }

      const [bookmark] = await db
        .select({ collectionId: bookmarks.collectionId })
        .from(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .limit(1);

      if (!bookmark) throw new NotFoundError();
      if (bookmark.collectionId != archivedId) {
        throw new ConflictError("Bookmark should be archived first");
      }
      await db.delete(bookmarks).where(eq(bookmarks.id, id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
