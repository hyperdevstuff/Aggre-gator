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
