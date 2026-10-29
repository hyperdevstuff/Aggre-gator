import { Elysia, t } from "elysia";
import { db } from "../db";
import {
  sharedCollections,
  collections,
  shareViews,
  bookmarks,
  bookmarkTags,
  collectionItems,
  tags,
  user,
} from "../db/schema";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { GoneError, NotFoundError } from "../error";
import { createPaginationMeta, normalizePagination } from "../utils/pagination";
import { rateLimitGuard } from "../utils/rate-limit";
import { getCollectionSubtreeMeta } from "../utils/collections";
import { buildExploreResponse, tagInSubtree } from "../utils/explore";
import { ftsCondition } from "../utils/full-text-search";
import { isCrawler } from "../utils/crawler";
import {
  spaEnabled,
  spaIndexResponse,
  wantsHtmlDocument,
} from "../utils/client-spa";
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
    async ({ query, request }) => {
      // A navigation to /share/explore is the SPA directory page, not a data
      // query — serve the shell and skip the facet work entirely.
      if (spaEnabled() && wantsHtmlDocument(request)) {
        return spaIndexResponse();
      }
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });
      const sort = query.sort ?? "new";
      const search = query.q?.trim();
      const tag = query.tag?.trim() || undefined;

      // Full-text over the generated `search_vector`, mirroring `/u/explore`.
      const searchFilter = search
        ? ftsCondition(sql`collections.search_vector`, search)
        : undefined;

      // System collections (Unsorted / Archived) are never publishable content.
      const candidateWhere = and(
        eq(collections.visibility, "public"),
        sql`${collections.publishedAt} is not null`,
        eq(collections.isSystem, false),
        searchFilter,
      )!;
      const where = tag ? and(candidateWhere, tagInSubtree(tag)) : candidateWhere;

      const selectRows = () =>
        db
          .select({
            code: sharedCollections.shareCode,
            id: collections.id,
            name: collections.name,
            description: collections.description,
            icon: collections.icon,
            color: collections.color,
            slug: collections.slug,
            username: user.username,
            sharedBy: user.name,
            sharedAt: collections.publishedAt,
          })
          .from(collections)
          .leftJoin(
            sharedCollections,
            eq(sharedCollections.collectionId, collections.id),
          )
          .innerJoin(user, eq(collections.userId, user.id));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(collections)
        .innerJoin(user, eq(collections.userId, user.id))
        .where(where);

      return await buildExploreResponse({
        sort,
        page,
        limit,
        offset,
        total: Number(count),
        candidateWhere,
        publishedAtOf: (row) => row.sharedAt,
        fetchPage: () => selectRows().where(where).orderBy(desc(collections.publishedAt)).limit(limit).offset(offset),
        fetchAllCandidates: () => selectRows().where(where).orderBy(desc(collections.publishedAt)),
      });
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
        // No minLength: `?tag=` (a cleared chip) must fall through to
        // "ignored" in the handler, not fail validation.
        tag: t.Optional(t.String({ maxLength: 100 })),
        sort: t.Optional(t.Union([t.Literal("new"), t.Literal("top")])),
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

      // Fire-and-forget view count, same rationale as the public router.
      void db
        .update(collections)
        .set({ viewCount: sql`${collections.viewCount} + 1` })
        .where(eq(collections.id, col.id))
        .catch(() => {});

      // Detailed per-view log (be-15). shareCode records which share link was
      // used; referrer is the HTTP Referer header (nullable). Fire-and-forget.
      // Normalise the referrer to origin only (scheme + host) so paths never
      // leak across sites; origin is all the referrer breakdown needs.
      const rawReferrer = request.headers.get("referer");
      let referrerOrigin: string | null = null;
      if (rawReferrer) {
        try {
          referrerOrigin = new URL(rawReferrer).origin;
        } catch {
          referrerOrigin = null;
        }
      }

      void db
        .insert(shareViews)
        .values({
          shareId: share.id,
          referrer: referrerOrigin,
          dayBucket: new Date(),
        })
        .catch(() => {});

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
      const nestedRows =
        allCollectionIds.length > 1
          ? await db
              .select({
                id: collections.id,
                name: collections.name,
                icon: collections.icon,
                color: collections.color,
              })
              .from(collections)
              .where(
                inArray(
                  collections.id,
                  allCollectionIds.filter((id) => id !== share.collectionId),
                ),
              )
          : [];

      // This page lists every descendant regardless of visibility, so the pill
      // counts follow the same rule rather than pruning private children.
      const nestedMeta = await getCollectionSubtreeMeta(
        nestedRows.map((row) => row.id),
        { includePrivateDescendants: true },
      );
      const nestedCollections = nestedRows.map((row) => ({
        ...row,
        bookmarkCount: nestedMeta.get(row.id)?.bookmarkCount ?? 0,
      }));

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

      // In the single-process deployment the API serves the SPA: a navigation
      // to the share page gets the app shell, while the app's own queries
      // (no navigation markers) still receive the JSON payload.
      if (spaEnabled() && wantsHtmlDocument(request)) {
        return spaIndexResponse();
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
