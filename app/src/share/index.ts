import { Elysia, t } from "elysia";
import { db } from "../db";
import {
  sharedCollections,
  collections,
  bookmarks,
  bookmarkTags,
  collectionItems,
  tags,
  user,
} from "../db/schema";
import { and, eq, ilike, inArray, or, sql, desc } from "drizzle-orm";
import { GoneError, NotFoundError } from "../error";
import { createPaginationMeta, normalizePagination } from "../utils/pagination";
import { rateLimitGuard } from "../utils/rate-limit";
import { collectionBookmarkCount } from "../utils/collections";
import { isCrawler } from "../utils/crawler";
import { renderCrawlerDocument } from "../utils/html";
import { env } from "../env";

/**
 * Every collection in the published subtree (the shared collection plus all
 * descendants) in one round trip. The previous per-level loop issued one query
 * per depth level; a recursive CTE keeps that at a single statement regardless
 * of how the nesting cap changes.
 */
async function getAllCollectionIds(
  collectionId: string,
  userId: string,
): Promise<string[]> {
  const result = (await db.execute(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM collections
        WHERE id = ${collectionId} AND user_id = ${userId}
      UNION ALL
      SELECT child.id FROM collections child
        JOIN subtree ON child.parent_id = subtree.id
        WHERE child.user_id = ${userId}
    )
    SELECT id FROM subtree
  `)) as { rows?: Array<{ id: string }> } | Array<{ id: string }>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return rows.map((row) => row.id);
}

export const shareRouter = new Elysia({ prefix: "/share" })
  // Public directory of every collection whose owner has published it.
  // Registered before `/:code` so `explore` is never swallowed by the param route.
  // No auth plugin — this is a public endpoint.
  //
  // Listing is driven by `collections.visibility`, not by `isActive`. A share
  // code now means "anyone with the link" (the unlisted tier); only
  // `visibility = 'public'` is enumerable. `GET /u/explore` is the successor to
  // this route and will replace it.
  .get(
    "/explore",
    async ({ query }) => {
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      const search = query.q?.trim();
      const searchFilter = search
        ? or(
            ilike(collections.name, `%${search}%`),
            ilike(collections.description, `%${search}%`),
          )
        : undefined;

      // System collections (Unsorted / Archived) are never publishable content.
      const where = and(
        eq(collections.visibility, "public"),
        sql`${collections.publishedAt} is not null`,
        eq(collections.isSystem, false),
        searchFilter,
      );

      const rows = await db
        .select({
          code: sharedCollections.shareCode,
          name: collections.name,
          description: collections.description,
          icon: collections.icon,
          color: collections.color,
          slug: collections.slug,
          username: user.username,
          sharedBy: user.name,
          sharedAt: collections.publishedAt,
          bookmarkCount: collectionBookmarkCount(collections.id).as(
            "bookmark_count",
          ),
        })
        .from(collections)
        .leftJoin(
          sharedCollections,
          eq(sharedCollections.collectionId, collections.id),
        )
        .innerJoin(user, eq(collections.userId, user.id))
        .where(where)
        .orderBy(desc(collections.publishedAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(collections)
        .innerJoin(user, eq(collections.userId, user.id))
        .where(where);

      return {
        data: rows,
        pagination: createPaginationMeta(page, limit, Number(count)),
      };
    },
    {
      // Anonymous, unlisted and enumerable: cap it so the directory cannot be
      // scraped (or used as a free search backend) without an account.
      beforeHandle: rateLimitGuard({
        name: "share:explore",
        limit: 60,
        perUser: false,
      }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1 })),
        q: t.Optional(t.String({ maxLength: 100 })),
      }),
    },
  )
  // No betterAuthPlugin — this is a public endpoint
  .get(
    "/:code",
    async ({ params: { code }, query, request }) => {
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
          slug: collections.slug,
        })
        .from(collections)
        .where(eq(collections.id, share.collectionId))
        .limit(1);

      if (!col) throw new NotFoundError("collection not found");
      const colSlug = col.slug;

      // get the sharing user's name and username — the username lets the crawler
      // document point its canonical at the readable `/u/...` URL instead of
      // the code, so the link a platform stores is the one the owner can change.
      const [sharer] = await db
        .select({ name: user.name, username: user.username })
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
                bookmarkCount: collectionBookmarkCount(collections.id).as(
                  "bookmark_count",
                ),
              })
              .from(collections)
              .where(
                inArray(
                  collections.id,
                  allCollectionIds.filter((id) => id !== share.collectionId),
                ),
              )
          : [];

      // paginate bookmarks across all collections
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      // Bookmarks filed in any collection of the subtree. Archived bookmarks are
      // excluded: archiving is the owner's filing decision, and a public page is
      // a publication, not a view of their private filing.
      const conditions = [
        inArray(
          bookmarks.id,
          db
            .select({ id: collectionItems.bookmarkId })
            .from(collectionItems)
            .where(inArray(collectionItems.collectionId, allCollectionIds)),
        ),
        sql`${bookmarks.archivedAt} is null`,
      ];

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
        // Deliberately narrower than the owner's bookmark row: `note` and
        // `isFavorite` are private state and must never reach an anonymous
        // reader of a public page.
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description,
        cover: bookmark.cover,
        domain: bookmark.domain,
        createdAt: bookmark.createdAt,
        tags: tagsByBookmark[bookmark.id] || [],
      }));

      const payload = {
        collection: col,
        sharedBy: sharer?.name || "Unknown",
        sharedAt: share.createdAt,
        bookmarks: {
          data: bookmarksWithTags,
          pagination: createPaginationMeta(page, limit, Number(count)),
        },
        nestedCollections,
      };

      // Crawlers get a static document. Served from this same handler, after
      // the same queries, so the preview and the page cannot disagree.
      if (isCrawler(request.headers.get("user-agent"))) {
        const total = Number(count);
        const canonical =
          sharer?.username && colSlug
            ? `${env.CLIENT_URL.replace(/\/$/, "")}/u/${sharer.username}/${colSlug}`
            : `${env.CLIENT_URL.replace(/\/$/, "")}/share/${code}`;
        return new Response(
          renderCrawlerDocument({
            title: col.name,
            description:
              col.description ??
              `${total} bookmark${total === 1 ? "" : "s"}, shared by ${sharer?.name || "someone"}.`,
            image: `${env.CLIENT_URL.replace(/\/$/, "")}/og/collection/${encodeURIComponent(share.collectionId)}.png`,
            url: canonical,
            type: "article",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "X-Robots-Tag": "noindex",
            },
          },
        );
      }

      return payload;
    },
    {
      beforeHandle: rateLimitGuard({
        name: "share:view",
        limit: 120,
        perUser: false,
      }),
      params: t.Object({ code: t.String() }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1 })),
      }),
    },
  );
