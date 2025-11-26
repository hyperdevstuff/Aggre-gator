import { Elysia, t } from "elysia";
import { db } from "../db";
import { ConflictError, NotFoundError } from "../error";
import { requireAuth } from "../utils/auth";
import { bookmarks, bookmarkTags, collections, tags } from "../db/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import scrapeMetadata from "../utils/metadata";
import { normalizePagination, createPaginationMeta } from "../utils/pagination";

export const bookmarksRouter = new Elysia({ prefix: "/bookmarks" })
  .use(requireAuth)
  .post(
    "/",
    async ({ body, userId }) => {
      const { tags: tagNames } = body;
      const existing = await db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.url, body.url)))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError();
      }

      const metadata = body.title
        ? {
            title: body.title,
            description: body.description || null,
            image: body.cover || null,
          }
        : await scrapeMetadata(body.url);

      const collectionId =
        body.collectionId ??
        (
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

      const [bookmark] = await db
        .insert(bookmarks)
        .values({
          url: body.url,
          note: body.note,
          collectionId,
          userId,
          domain: new URL(body.url).hostname,
          isFavorite: body.isFavorite ?? false,
          title: body.title || new URL(body.url).hostname,
          description: metadata.description || null,
          cover: body.cover || null,
        })
        .returning();

      if (!body.title) {
        scrapeMetadata(body.url)
          .then(async (meta) => {
            await db
              .update(bookmarks)
              .set({
                title: meta.title,
                description: meta.description,
                cover: meta.image,
              })
              .where(eq(bookmarks.id, bookmark.id));
          })
          .catch(() => {});
      }

      if (tagNames && tagNames.length > 0) {
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

        await db.insert(bookmarkTags).values(
          tagIds.map((tagId: string) => ({
            bookmarkId: bookmark.id,
            tagId,
          })),
        );
      }

      return bookmark;
    },
    {
      body: t.Object({
        url: t.String({ format: "uri" }),
        title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
        description: t.Optional(t.String({ maxLength: 2000 })),
        cover: t.Optional(t.String({ format: "uri", maxLength: 1000 })),
        note: t.Optional(t.String()),
        isFavorite: t.Optional(t.Boolean()),
        collectionId: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
      }),
    },
  )
  .get(
    "/",
    async ({ query, userId }) => {
      const {
        collectionId,
        isFavorite,
        search,
        sort = "created_desc",
        tagIds,
      } = query;
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      let conditions = [eq(bookmarks.userId, userId)];

      if (collectionId) {
        conditions.push(eq(bookmarks.collectionId, collectionId));
      }

      if (isFavorite !== undefined) {
        conditions.push(eq(bookmarks.isFavorite, isFavorite));
      }

      if (search) {
        const sanitized = search.replace(/[%_]/g, "\\$&");
        conditions.push(sql`${bookmarks.title} ILIKE ${"%" + sanitized + "%"}`);
      }

      if (tagIds && tagIds.length > 0) {
        const bookmarkIdsWithTags = await db
          .select({ bookmarkId: bookmarkTags.bookmarkId })
          .from(bookmarkTags)
          .where(inArray(bookmarkTags.tagId, tagIds))
          .groupBy(bookmarkTags.bookmarkId)
          .having(
            sql`COUNT(DISTINCT ${bookmarkTags.tagId}) = ${tagIds.length}`,
          );

        const ids = bookmarkIdsWithTags.map((b) => b.bookmarkId);
        if (ids.length === 0)
          return {
            data: [],
            pagination: createPaginationMeta(page, limit, 0),
          };
        conditions.push(inArray(bookmarks.id, ids));
      }

      const query_builder = db
        .select()
        .from(bookmarks)
        .where(and(...conditions));

      const orderBy =
        sort === "created_asc"
          ? asc(bookmarks.createdAt)
          : sort === "title_asc"
            ? asc(bookmarks.title)
            : sort === "title_desc"
              ? desc(bookmarks.title)
              : desc(bookmarks.createdAt);

      const [data, [{ count }]] = await Promise.all([
        query_builder.orderBy(orderBy).limit(limit).offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(bookmarks)
          .where(and(...conditions)),
      ]);

      const bookmarkIds = data.map((b) => b.id);
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

      const dataWithTags = data.map((bookmark) => ({
        ...bookmark,
        tags: tagsByBookmark[bookmark.id] || [],
      }));

      return {
        data: dataWithTags,
        pagination: createPaginationMeta(page, limit, Number(count)),
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1 })),
        collectionId: t.Optional(t.String()),
        isFavorite: t.Optional(t.Boolean()),
        search: t.Optional(t.String()),
        sort: t.Optional(
          t.Union([
            t.Literal("created_desc"),
            t.Literal("created_asc"),
            t.Literal("title_asc"),
            t.Literal("title_desc"),
          ]),
        ),
        tagIds: t.Optional(t.Array(t.String())),
      }),
    },
  )
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

      const [bookmark] = await db
        .update(bookmarks)
        .set({ collectionId: archivedId })
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .returning();

      if (!bookmark) throw new NotFoundError();

      return { success: true, archived: archivedId };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
