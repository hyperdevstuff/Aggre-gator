import {
  and,
  asc,
  eq,
  inArray,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { db } from "../db";
import { collectionItems, collections } from "../db/schema";
import { NotFoundError } from "../error";

/** Query surface shared by `db` and transaction handles. */
export type DbOrTx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/** Owner-scoped lookup of the Unsorted system collection. */
export async function getSystemCollectionId(
  dbOrTx: DbOrTx,
  userId: string,
  slug: "unsorted",
): Promise<string | undefined> {
  const [row] = await dbOrTx
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.userId, userId), eq(collections.slug, slug)))
    .limit(1);
  return row?.id;
}

/** Throw 404 unless the collection exists and belongs to the user. */
export async function requireUserCollection(
  dbOrTx: DbOrTx,
  userId: string,
  collectionId: string,
): Promise<string> {
  const [row] = await dbOrTx
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .limit(1);
  if (!row) throw new NotFoundError("collection not found");
  return row.id;
}

/**
 * Bookmark → collection memberships in one query, ordered by the per-collection
 * position so the order is stable.
 */
export async function getBookmarkCollectionIds(
  dbOrTx: DbOrTx,
  bookmarkIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (bookmarkIds.length === 0) return map;

  const rows = await dbOrTx
    .select({
      bookmarkId: collectionItems.bookmarkId,
      collectionId: collectionItems.collectionId,
    })
    .from(collectionItems)
    .where(inArray(collectionItems.bookmarkId, bookmarkIds))
    .orderBy(asc(collectionItems.position), asc(collectionItems.createdAt));

  for (const row of rows) {
    const list = map.get(row.bookmarkId) ?? [];
    list.push(row.collectionId);
    map.set(row.bookmarkId, list);
  }
  return map;
}

/**
 * Validate and normalise the collection ids for a create request: an empty
 * request files the bookmark into the owner's Unsorted collection by default.
 * Throws 404 on a foreign or missing id.
 */
export async function resolveCreateCollections(
  dbOrTx: DbOrTx,
  userId: string,
  requested: string[] | undefined,
): Promise<string[]> {
  const ids = requested ? [...new Set(requested)] : [];
  for (const id of ids) await requireUserCollection(dbOrTx, userId, id);
  if (ids.length > 0) return ids;

  const unsortedId = await getSystemCollectionId(dbOrTx, userId, "unsorted");
  if (!unsortedId) throw new NotFoundError("unsorted collection not found");
  return [unsortedId];
}

/** Replace a bookmark's memberships, validating that each collection is owned. */
export async function setBookmarkCollections(
  dbOrTx: DbOrTx,
  userId: string,
  bookmarkId: string,
  collectionIds: string[],
): Promise<void> {
  const ids = [...new Set(collectionIds)];
  for (const id of ids) await requireUserCollection(dbOrTx, userId, id);
  await dbOrTx
    .delete(collectionItems)
    .where(eq(collectionItems.bookmarkId, bookmarkId));
  if (ids.length > 0) {
    await dbOrTx.insert(collectionItems).values(
      ids.map((collectionId, position) => ({
        collectionId,
        bookmarkId,
        position,
      })),
    );
  }
}

/** True when `bookmarkIdSql` is filed in `collectionIdSql`. */
export function isInCollection(
  bookmarkIdSql: SQLWrapper,
  collectionIdSql: SQLWrapper | string,
): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${collectionItems}
    WHERE ${collectionItems.bookmarkId} = ${bookmarkIdSql}
      AND ${collectionItems.collectionId} = ${collectionIdSql}
  )`;
}

/** Number of bookmarks filed in one collection. */
export function collectionBookmarkCount(
  collectionIdSql: SQLWrapper | string,
): SQL<number> {
  return sql<number>`(
    SELECT COUNT(*) FROM ${collectionItems}
    WHERE ${collectionItems.collectionId} = ${collectionIdSql}
  )::int`;
}

export type CollectionSubtreeMeta = {
  /** Non-archived bookmarks across the whole subtree, counted once each. */
  bookmarkCount: number;
  /** Up to 4 distinct cover images from those bookmarks. */
  covers: string[];
};

type SubtreeMetaRow = {
  root_id: string;
  bookmark_count: number | string;
  covers: string[] | null;
};

/**
 * Bookmark count and cover thumbnails for several collections at once, counted
 * across each collection's entire subtree rather than only its direct members.
 *
 * This is the public-facing count: it matches what a visitor actually sees on
 * the readable page (`buildPublicCollectionPage`), which lists bookmarks from
 * the subtree of *non-private* descendants and hides archived ones. The direct
 * `collectionBookmarkCount` above is still used for the owner's dashboard.
 *
 * One query for the whole page — the recursive CTE closes over every root at
 * once, so a 24-card listing is one round trip, not 24.
 */
export async function getCollectionSubtreeMeta(
  rootIds: string[],
  opts: { includePrivateDescendants?: boolean } = {},
): Promise<Map<string, CollectionSubtreeMeta>> {
  const map = new Map<string, CollectionSubtreeMeta>();
  if (rootIds.length === 0) return map;

  // Bind each id separately; never interpolate user-controlled values.
  const idList = sql.join(
    rootIds.map((id) => sql`${id}`),
    sql`, `,
  );
  // A private child must not contribute to a public parent's count, matching
  // the listing. The share-code page lists every descendant, so it opts out.
  const descendantFilter = opts.includePrivateDescendants
    ? sql``
    : sql`AND c.visibility <> 'private'`;

  const result = (await db.execute(sql`
    WITH RECURSIVE tree AS (
      SELECT id, id AS root_id FROM collections WHERE id IN (${idList})
      UNION ALL
      SELECT c.id, t.root_id
      FROM collections c
      JOIN tree t ON c.parent_id = t.id
      WHERE true ${descendantFilter}
    )
    SELECT t.root_id AS root_id,
      count(DISTINCT ci.bookmark_id) FILTER (WHERE b.archived_at IS NULL)::int AS bookmark_count,
      (array_agg(DISTINCT b.cover) FILTER (
        WHERE b.cover IS NOT NULL AND b.archived_at IS NULL
      ))[1:4] AS covers
    FROM tree t
    LEFT JOIN collection_items ci ON ci.collection_id = t.id
    LEFT JOIN bookmarks b ON b.id = ci.bookmark_id
    GROUP BY t.root_id
  `)) as { rows?: SubtreeMetaRow[] } | SubtreeMetaRow[];

  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  for (const row of rows) {
    map.set(row.root_id, {
      bookmarkCount: Number(row.bookmark_count ?? 0),
      covers: row.covers ?? [],
    });
  }
  // Every requested id resolves, even when the query returns nothing for it.
  for (const id of rootIds) {
    if (!map.has(id)) map.set(id, { bookmarkCount: 0, covers: [] });
  }
  return map;
}
