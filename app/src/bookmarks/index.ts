import { Elysia, t } from "elysia";
import { db } from "../db";
import { bookmarks, bookmarkTags, tags } from "../db/schema";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { ConflictError } from "../error";
import { betterAuthPlugin } from "../utils/auth";
import {
  getBookmarkCollectionIds,
  isInCollection,
  resolveCreateCollections,
  setBookmarkCollections,
} from "../utils/collections";
import { enqueue } from "../utils/jobs";
import { createPaginationMeta, normalizePagination } from "../utils/pagination";
import { rateLimitGuard } from "../utils/rate-limit";
import { bookmarksIdRouter } from "./$id";
import { bookmarksBulkRouter } from "./bulk";

/**
 * Queue the metadata enrichment for a freshly created bookmark.
 *
 * Was an in-process `setTimeout(..., 0).unref()` fire-and-forget, which lost
 * the work whenever the process went away mid-flight — a Render free-tier sleep
 * or a deploy. It is now a row in `jobs`, so the worker picks it up whenever it
 * next runs, including after a restart. See `utils/jobs.ts` and ADR-003.
 *
 * Which fields the user supplied is carried in the payload rather than re-read
 * here, so a value set in this same request still wins after a retry.
 */
async function scheduleEnrichment({
  id,
  url,
  placeholderTitle,
  keep,
}: {
  id: string;
  url: string;
  placeholderTitle: string;
  keep: { title: boolean; description: boolean; cover: boolean };
}) {
  try {
    // Awaited, not fired and forgotten: the insert is what makes the work
    // durable, and a response returned before it lands can outlive the row if
    // the process goes away in between — the same silent loss the queue was
    // introduced to stop. It is one indexed insert; the scrape is still off the
    // request path.
    await enqueue("enrich-metadata", {
      bookmarkId: id,
      url,
      placeholderTitle,
      keep,
    });
  } catch (error) {
    // The bookmark is already saved; losing the enrichment is recoverable by
    // hand, so this must not fail the request.
    console.error(
      `[bookmarks] could not enqueue enrichment for ${id}: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
}

export const bookmarksRouter = new Elysia({ prefix: "/bookmarks" })
  .use(betterAuthPlugin)
  .post(
    "/",
    async ({ body, user }) => {
      const userId = user.id;
      const { tags: tagNames } = body;
      const existing = await db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.url, body.url)))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError("This URL is already saved.", {
          existingId: existing[0].id,
        });
      }

      const hostname = new URL(body.url).hostname;
      // Whatever the caller supplied wins; whatever it did not is filled in
      // after the response has been sent, so saving never blocks on a slow page.
      const title = body.title || hostname;
      const description = body.description ?? null;
      const cover = body.cover ?? null;

      // Validates ownership and defaults to Unsorted when nothing was chosen.
      const collectionIds = await resolveCreateCollections(
        db,
        userId,
        body.collectionIds,
      );

      const [bookmark] = await db
        .insert(bookmarks)
        .values({
          url: body.url,
          note: body.note,
          userId,
          domain: hostname,
          isFavorite: body.isFavorite ?? false,
          title,
          description,
          cover,
        })
        .returning();

      await setBookmarkCollections(db, userId, bookmark.id, collectionIds);

      // Scrape once, after the response is out. Per-field guards in the handler
      // mean an edit that lands while the fetch is in flight is never clobbered
      // by the scraped value, and a dead URL simply keeps its hostname title.
      // Enrich whenever the caller left a field for the scraper to fill. Gating
      // on the title alone meant a bookmark the user titled by hand could never
      // acquire a cover — the reason covers were missing on exactly the saves
      // where the user had typed something.
      if (!body.title || !description || !cover) {
        await scheduleEnrichment({
          id: bookmark.id,
          url: body.url,
          placeholderTitle: title,
          keep: {
            title: Boolean(body.title),
            description: description !== null,
            cover: cover !== null,
          },
        });
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

      return { ...bookmark, collectionIds };
    },
    {
      // Each create can trigger an outbound fetch to the saved URL, so this is
      // the route worth capping: 120/minute per user is far above real use.
      beforeHandle: rateLimitGuard({ name: "bookmarks:create", limit: 120 }),
      body: t.Object({
        url: t.String({ format: "uri" }),
        title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
        description: t.Optional(t.String({ maxLength: 2000 })),
        cover: t.Optional(t.String({ format: "uri", maxLength: 1000 })),
        note: t.Optional(t.String()),
        isFavorite: t.Optional(t.Boolean()),
        collectionIds: t.Optional(t.Array(t.String())),
        tags: t.Optional(t.Array(t.String())),
      }),
    },
  )
  .get(
    "/",
    async ({ query, user }) => {
      const userId = user.id;
      const {
        collectionId,
        isFavorite,
        search,
        sort = "created_desc",
        tagIds,
        archived,
        includeArchived = false,
      } = query;

      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      let conditions = [eq(bookmarks.userId, userId)];

      // Archived is a property of the bookmark now, not a collection it was
      // moved into, so the bookmark keeps where it belonged while archived.
      if (archived === true) {
        conditions.push(isNotNull(bookmarks.archivedAt));
      } else if (!includeArchived) {
        conditions.push(isNull(bookmarks.archivedAt));
      }

      if (collectionId) {
        conditions.push(isInCollection(bookmarks.id, collectionId));
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
              : sort === "url_asc"
                ? asc(bookmarks.url)
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

      const memberships = await getBookmarkCollectionIds(db, bookmarkIds);
      const dataWithTags = data.map((bookmark) => ({
        ...bookmark,
        collectionIds: memberships.get(bookmark.id) ?? [],
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
        archived: t.Optional(t.Boolean()),
        includeArchived: t.Optional(t.Boolean()),
        search: t.Optional(t.String()),
        sort: t.Optional(
          t.Union([
            t.Literal("created_desc"),
            t.Literal("created_asc"),
            t.Literal("title_asc"),
            t.Literal("title_desc"),
            t.Literal("url_asc"),
          ]),
        ),
        tagIds: t.Optional(t.Array(t.String())),
      }),
    },
  )
  .use(bookmarksIdRouter)
  .use(bookmarksBulkRouter);
