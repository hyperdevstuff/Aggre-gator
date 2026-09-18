import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { collections } from "../db/schema";
import { NotFoundError } from "../error";

/** Query surface shared by `db` and transaction handles. */
export type DbOrTx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/** Owner-scoped lookup of a system collection ("unsorted" / "archived"). */
export async function getSystemCollectionId(
  dbOrTx: DbOrTx,
  userId: string,
  slug: "unsorted" | "archived",
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
