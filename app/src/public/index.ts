import { Elysia, t } from "elysia";
import { db } from "../db";
import {
  bookmarks,
  bookmarkTags,
  collectionItems,
  collections,
  sharedCollections,
  tags,
  user as users,
} from "../db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { NotFoundError } from "../error";
import { createPaginationMeta, normalizePagination } from "../utils/pagination";
import { rateLimitGuard } from "../utils/rate-limit";
import { getCollectionSubtreeMeta } from "../utils/collections";
import { buildExploreResponse, tagInSubtree } from "../utils/explore";
import { ftsCondition } from "../utils/full-text-search";
import { usernameEq } from "../utils/user-identity";
import { isCrawler } from "../utils/crawler";
import { renderCrawlerDocument } from "../utils/html";
import { env } from "../env";

/** Absolute URL on the public origin, where the SPA and the pages live. */
function publicUrl(path: string): string {
  return `${env.CLIENT_URL.replace(/\/$/, "")}${path}`;
}

/**
 * Headers for the crawler document. `noindex` keeps it out of search results —
 * the ADR is explicit that this is a link-preview surface, not an SEO one, and
 * a bodyless document should not compete for queries.
 */
function htmlHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    // Crawlers fetch once and cache aggressively upstream; a short shared cache
    // keeps a busy edge from re-running these queries for every unfurl.
    "Cache-Control": "public, max-age=300",
    "X-Robots-Tag": "noindex",
  };
}

/**
 * The Open Graph image for a page.
 *
 * `/og/...` is served by the API rather than nginx: the SPA catch-all would
 * otherwise swallow the route and return `index.html` with a `text/html`
 * content type, which every platform rejects. Rendered lazily by that route, so
 * nothing is computed here.
 */
function ogImageUrl(kind: "profile" | "collection", id: string): string {
  return publicUrl(`/og/${kind}/${encodeURIComponent(id)}.png`);
}

/**
 * The account behind a `/u/:username` path, or null. Case-insensitive.
 *
 * Only the fields a public profile may expose — never email, never `emailVerified`,
 * never `plan`. Better-auth's session user is not used here: it carries fields
 * an anonymous reader must not see.
 */
async function findPublicProfile(username: string) {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      bio: users.bio,
      avatar: users.avatar,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(usernameEq(username))
    .limit(1);
  return row ?? null;
}

/** Every collection in the subtree rooted at `collectionId`, in one round trip. */
async function getSubtreeIds(
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

/**
 * A public collection's page payload.
 *
 * Deliberately identical in shape to `GET /share/:code` so the client renders
 * one component for both surfaces — the random code is the unlisted URL and
 * `/u/:username/:slug` is the readable one, and they must not drift apart.
 */
async function buildPublicCollectionPage(
  collectionId: string,
  ownerId: string,
  opts: { page: number; limit: number; offset: number },
) {
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
    .where(eq(collections.id, collectionId))
    .limit(1);
  if (!col) throw new NotFoundError("collection not found");

  const subtreeIds = await getSubtreeIds(collectionId, ownerId);
  // Bookmarks anywhere in the subtree, but only via collections the owner has
  // published. A private sub-collection must not contribute bookmarks to a
  // public parent's page — publishing a parent never publishes its children.
  const visibleIds =
    subtreeIds.length > 1
      ? (
          await db
            .select({ id: collections.id })
            .from(collections)
            .where(
              and(
                inArray(collections.id, subtreeIds),
                sql`${collections.visibility} <> 'private'`,
              ),
            )
        ).map((row) => row.id)
      : subtreeIds;

  const bookmarkIdsInSubtree = db
    .select({ id: collectionItems.bookmarkId })
    .from(collectionItems)
    .where(inArray(collectionItems.collectionId, visibleIds));

  const conditions = [
    inArray(bookmarks.id, bookmarkIdsInSubtree),
    sql`${bookmarks.archivedAt} is null`,
  ];

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: bookmarks.id,
        url: bookmarks.url,
        title: bookmarks.title,
        description: bookmarks.description,
        cover: bookmarks.cover,
        domain: bookmarks.domain,
        createdAt: bookmarks.createdAt,
      })
      .from(bookmarks)
      .where(and(...conditions))
      .orderBy(desc(bookmarks.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookmarks)
      .where(and(...conditions)),
  ]);

  // Tags for this page only, not the whole collection.
  const ids = rows.map((row) => row.id);
  const tagRows =
    ids.length > 0
      ? await db
          .select({
            bookmarkId: bookmarkTags.bookmarkId,
            tagId: tags.id,
            tagName: tags.name,
            tagColor: tags.color,
          })
          .from(bookmarkTags)
          .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
          .where(inArray(bookmarkTags.bookmarkId, ids))
      : [];
  const tagsByBookmark = tagRows.reduce<Record<string, Array<{ id: string; name: string; color: string | null }>>>(
    (acc, row) => {
      (acc[row.bookmarkId] ??= []).push({
        id: row.tagId,
        name: row.tagName,
        color: row.tagColor,
      });
      return acc;
    },
    {},
  );

  // Nested collections are listed flat, matching `/share/:code`. Filtered to
  // the same published set as the bookmark listing above, so the pills and the
  // grid can never disagree about what is visible.
  const nestedRows =
    visibleIds.length > 1
      ? await db
          .select({
            id: collections.id,
            name: collections.name,
            icon: collections.icon,
            color: collections.color,
            slug: collections.slug,
          })
          .from(collections)
          .where(
            and(
              inArray(collections.id, visibleIds),
              sql`${collections.id} <> ${collectionId}`,
              eq(collections.isSystem, false),
            ),
          )
          .orderBy(asc(collections.name))
      : [];

  // The pill counts include each child's own subtree, so they agree with the
  // grid the visitor gets after clicking through.
  const nestedMeta = await getCollectionSubtreeMeta(
    nestedRows.map((row) => row.id),
  );
  const nested = nestedRows.map((row) => ({
    ...row,
    bookmarkCount: nestedMeta.get(row.id)?.bookmarkCount ?? 0,
  }));

  return {
    collection: col,
    bookmarks: {
      data: rows.map((row) => ({ ...row, tags: tagsByBookmark[row.id] ?? [] })),
      pagination: createPaginationMeta(opts.page, opts.limit, Number(count)),
    },
    nestedCollections: nested,
  };
}

export const publicRouter = new Elysia({ prefix: "/u" })
  // Public directory of every collection whose owner has published it.
  // Registered before `/:username` so `explore` is never swallowed by the param.
  .get(
    "/explore",
    async ({ query }) => {
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });
      const sort = query.sort ?? "new";
      const search = query.q?.trim();
      const tag = query.tag?.trim() || undefined;

      // Full-text over the generated `search_vector` (name + description):
      // whole words via websearch, partial words via the prefix arm, so "zepp"
      // still finds "Zeppelin Notes".
      const searchFilter = search
        ? ftsCondition(sql`collections.search_vector`, search)
        : undefined;

      // `visibility = 'public'` is the only listing condition. An unlisted
      // collection is reachable by link and must never appear here; a `share`
      // code no longer implies listing.
      // `publishedAt is not null` as well as `visibility = 'public'`: the two are
      // kept in sync on write, and the non-null test keeps rows that never
      // finished publishing out of an index ordered by `published_at`.
      const candidateWhere = and(
        eq(collections.visibility, "public"),
        eq(collections.isSystem, false),
        sql`${collections.publishedAt} is not null`,
        searchFilter,
      )!;
      // The tag filter narrows the listing but not the facets, so the chips a
      // visitor sees do not shuffle once one is pressed.
      const where = tag ? and(candidateWhere, tagInSubtree(tag)) : candidateWhere;

      const selectRows = () =>
        db
          .select({
            id: collections.id,
            name: collections.name,
            description: collections.description,
            icon: collections.icon,
            color: collections.color,
            slug: collections.slug,
            username: users.username,
            sharedBy: users.name,
            publishedAt: collections.publishedAt,
          })
          .from(collections)
          .innerJoin(users, eq(collections.userId, users.id));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(collections)
        .innerJoin(users, eq(collections.userId, users.id))
        .where(where);

      return await buildExploreResponse({
        sort,
        page,
        limit,
        offset,
        total: Number(count),
        candidateWhere,
        publishedAtOf: (row) => row.publishedAt,
        fetchPage: () => selectRows().where(where).orderBy(desc(collections.publishedAt)).limit(limit).offset(offset),
        fetchAllCandidates: () => selectRows().where(where).orderBy(desc(collections.publishedAt)),
      });
    },
    {
      beforeHandle: rateLimitGuard({ name: "public:explore", limit: 60, perUser: false }),
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
  .get(
    "/:username",
    async ({ params: { username }, query, request }) => {
      const profile = await findPublicProfile(username);
      if (!profile) throw new NotFoundError("profile not found");

      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      const publicFilter = and(
        eq(collections.userId, profile.id),
        eq(collections.visibility, "public"),
        eq(collections.isSystem, false),
      );

      const [rows, countRows, bookmarkRows] = await Promise.all([
        db
          .select({
            id: collections.id,
            name: collections.name,
            description: collections.description,
            icon: collections.icon,
            color: collections.color,
            slug: collections.slug,
            publishedAt: collections.publishedAt,
          })
          .from(collections)
          .where(publicFilter)
          .orderBy(desc(collections.publishedAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(collections)
          .where(publicFilter),
        // Bookmarks across the owner's published collections, de-duplicated —
        // a bookmark filed in two of them counts once.
        db
          .select({
            bookmarkCount: sql<number>`count(distinct ${bookmarks.id})::int`,
          })
          .from(bookmarks)
          .innerJoin(
            collectionItems,
            eq(collectionItems.bookmarkId, bookmarks.id),
          )
          .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
          .where(
            and(
              eq(collections.userId, profile.id),
              eq(collections.visibility, "public"),
              sql`${bookmarks.archivedAt} is null`,
            ),
          ),
      ]);

      const collectionMeta = await getCollectionSubtreeMeta(
        rows.map((row) => row.id),
      );
      const collectionsWithCovers = rows.map((row) => ({
        ...row,
        bookmarkCount: collectionMeta.get(row.id)?.bookmarkCount ?? 0,
        covers: collectionMeta.get(row.id)?.covers ?? [],
      }));

      const payload = {
        profile: {
          username: profile.username,
          name: profile.name,
          bio: profile.bio,
          avatar: profile.avatar ?? profile.image ?? null,
          joinedAt: profile.createdAt,
          // Counts that exist today. Follower counts arrive with the follow
          // feature in phase 5 — rendering zeros before then would be a lie.
          stats: {
            publicCollections: Number(countRows[0]?.count ?? 0),
            publicBookmarks: bookmarkRows[0]?.bookmarkCount ?? 0,
          },
        },
        collections: {
          data: collectionsWithCovers,
          pagination: createPaginationMeta(
            page,
            limit,
            Number(countRows[0]?.count ?? 0),
          ),
        },
      };

      // Crawlers get a static document instead of the SPA's empty shell. This
      // runs *after* the same queries the JSON response uses, so the preview
      // and the page a human sees can never disagree.
      if (isCrawler(request.headers.get("user-agent"))) {
        const collectionCount = payload.profile.stats.publicCollections;
        return new Response(
          renderCrawlerDocument({
            title: `${profile.name} (@${profile.username})`,
            description:
              profile.bio ??
              `${collectionCount} published collection${collectionCount === 1 ? "" : "s"} on Aggregator.`,
            image: ogImageUrl("profile", profile.username!),
            url: publicUrl(`/u/${profile.username}`),
            type: "profile",
          }),
          { status: 200, headers: htmlHeaders() },
        );
      }

      return payload;
    },
    {
      beforeHandle: rateLimitGuard({ name: "public:profile", limit: 60, perUser: false }),
      params: t.Object({ username: t.String({ minLength: 1, maxLength: 64 }) }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1 })),
      }),
    },
  )
  .get(
    "/:username/:slug",
    async ({ params: { username, slug }, query, request }) => {
      const profile = await findPublicProfile(username);
      if (!profile) throw new NotFoundError("profile not found");

      const [col] = await db
        .select({
          id: collections.id,
          slug: collections.slug,
          visibility: collections.visibility,
          publishedAt: collections.publishedAt,
        })
        .from(collections)
        .where(and(eq(collections.userId, profile.id), eq(collections.slug, slug)))
        .limit(1);

      // A private collection is 404, not 403: confirming it exists leaks that
      // the user owns a collection by that name.
      if (!col || col.visibility === "private") {
        throw new NotFoundError("collection not found");
      }

      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });
      const payload = await buildPublicCollectionPage(col.id, profile.id, {
        page,
        limit,
        offset,
      });

      const shareCode = await activeShareCode(col.id, profile.id);
      const result = {
        ...payload,
        owner: {
          username: profile.username,
          name: profile.name,
          avatar: profile.avatar ?? profile.image ?? null,
        },
        // The unlisted fallback, so a client can offer it without a second call.
        shareCode,
      };

      // Crawlers get the readable URL as canonical even when they arrived via a
      // share code, so the link a platform stores is the one the owner can
      // change.
      const canonical = publicUrl(`/u/${profile.username}/${slug}`);
      if (isCrawler(request.headers.get("user-agent"))) {
        const count = payload.bookmarks.pagination?.total ?? 0;
        return new Response(
          renderCrawlerDocument({
            title: payload.collection.name,
            description:
              payload.collection.description ??
              `${count} bookmark${count === 1 ? "" : "s"}, collected by ${profile.name}.`,
            image: ogImageUrl("collection", col.id),
            url: canonical,
            type: "article",
          }),
          { status: 200, headers: htmlHeaders() },
        );
      }

      return result;
    },
    {
      beforeHandle: rateLimitGuard({ name: "public:collection", limit: 120, perUser: false }),
      params: t.Object({
        username: t.String({ minLength: 1, maxLength: 64 }),
        slug: t.String({ minLength: 1, maxLength: 100 }),
      }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1 })),
      }),
    },
  );

/** The owner's active share code for a collection, if one exists. */
async function activeShareCode(
  collectionId: string,
  ownerId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ code: sharedCollections.shareCode })
    .from(sharedCollections)
    .where(
      and(
        eq(sharedCollections.collectionId, collectionId),
        eq(sharedCollections.userId, ownerId),
        eq(sharedCollections.isActive, true),
      ),
    )
    .limit(1);
  return row?.code ?? null;
}