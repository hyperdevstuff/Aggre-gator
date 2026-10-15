import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { createPaginationMeta } from "./pagination";
import { getCollectionSubtreeMeta } from "./collections";

/**
 * Explore's tag machinery.
 *
 * Tags live on bookmarks, never on collections, so "a collection has tag X"
 * means "some non-archived bookmark filed anywhere in its subtree carries X" —
 * the same subtree rule the counts and covers use (`getCollectionSubtreeMeta`):
 * private descendants are pruned, archived bookmarks never contribute.
 */

type Row = Record<string, unknown>;

function rowsOf(result: { rows?: Row[] } | Row[]): Row[] {
  return Array.isArray(result) ? result : (result.rows ?? []);
}

/**
 * SQL condition: the collection's subtree contains a non-archived bookmark
 * tagged `tag` (case-insensitive).
 *
 * The recursive CTE anchors on `root.id = collections.id` — the inner table is
 * aliased so `collections.id` resolves to the *outer* row being tested, not to
 * the CTE's own scan.
 */
export function tagInSubtree(tag: string): SQL {
  return sql`EXISTS (
    WITH RECURSIVE subtree AS (
      SELECT id FROM collections root WHERE root.id = collections.id
      UNION ALL
      SELECT c.id FROM collections c JOIN subtree ON c.parent_id = subtree.id
      WHERE c.visibility <> 'private'
    )
    SELECT 1
    FROM subtree
    JOIN collection_items ci ON ci.collection_id = subtree.id
    JOIN bookmarks b ON b.id = ci.bookmark_id AND b.archived_at IS NULL
    JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    JOIN tags tg ON tg.id = bt.tag_id
    WHERE lower(tg.name) = lower(${tag})
  )`;
}

/**
 * The most-used tags across a candidate set of collections, for the Explore
 * facet chips.
 *
 * `candidateWhere` is the listing's filter *without* the tag condition, so the
 * chips stay stable while one is active. Counts are distinct collections — a
 * tag on five bookmarks of one collection counts once.
 */
export async function getPublicTagFacets(
  candidateWhere: SQL,
  limit = 12,
): Promise<Array<{ tag: string; count: number }>> {
  const result = (await db.execute(sql`
    WITH RECURSIVE candidates AS (
      SELECT id FROM collections WHERE ${candidateWhere}
    ),
    tree AS (
      SELECT id, id AS root_id FROM candidates
      UNION ALL
      SELECT c.id, t.root_id FROM collections c JOIN tree t ON c.parent_id = t.id
      WHERE c.visibility <> 'private'
    )
    SELECT lower(tg.name) AS tag, count(DISTINCT tree.root_id)::int AS count
    FROM tree
    JOIN collection_items ci ON ci.collection_id = tree.id
    JOIN bookmarks b ON b.id = ci.bookmark_id AND b.archived_at IS NULL
    JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    JOIN tags tg ON tg.id = bt.tag_id
    GROUP BY lower(tg.name)
    ORDER BY count DESC, tag ASC
    LIMIT ${limit}
  `)) as { rows?: Array<{ tag: string; count: number | string }> } | Array<{
    tag: string;
    count: number | string;
  }>;

  return rowsOf(result).map((row) => ({
    tag: String(row.tag),
    count: Number(row.count ?? 0),
  }));
}

export type ExploreSort = "new" | "top";

export type ExploreEntry = { id: string };
export type ExploreEntryEnriched<T> = T & {
  bookmarkCount: number;
  covers: string[];
};

/**
 * Assemble an Explore directory response.
 *
 * `sort: "new"` is the cheap path — the caller pages in SQL and this only
 * enriches the page. `sort: "top"` has to order by the *subtree* bookmark
 * count, which is not a column, so every candidate row is fetched, enriched
 * through one batched `getCollectionSubtreeMeta` call (the same code path the
 * cards display), sorted here, and sliced. Two queries instead of a correlated
 * LATERAL per row, and the numbers on the cards can never disagree with the
 * order they were sorted by.
 *
 * `candidateWhere` is the listing filter *without* the tag condition, so the
 * facet chips stay stable while one is active. `publishedAtOf` picks the
 * recency field off a row — `/u/explore` calls it `publishedAt`, the legacy
 * `/share/explore` calls the same column `sharedAt`.
 */
export async function buildExploreResponse<T extends ExploreEntry>(args: {
  sort: ExploreSort;
  page: number;
  limit: number;
  offset: number;
  total: number;
  candidateWhere: SQL;
  publishedAtOf: (row: T) => Date | null;
  fetchPage: () => Promise<T[]>;
  fetchAllCandidates: () => Promise<T[]>;
}): Promise<{
  data: Array<ExploreEntryEnriched<T>>;
  pagination: ReturnType<typeof createPaginationMeta>;
  facets: Array<{ tag: string; count: number }>;
}> {
  const facets = await getPublicTagFacets(args.candidateWhere);

  const enrich = (
    rows: T[],
    meta: Map<string, { bookmarkCount: number; covers: string[] }>,
  ): Array<ExploreEntryEnriched<T>> =>
    rows.map((row) => ({
      ...row,
      bookmarkCount: meta.get(row.id)?.bookmarkCount ?? 0,
      covers: meta.get(row.id)?.covers ?? [],
    }));

  if (args.sort === "top") {
    const all = await args.fetchAllCandidates();
    const meta = await getCollectionSubtreeMeta(all.map((row) => row.id));
    const ranked = enrich(all, meta).sort(
      (a, b) =>
        b.bookmarkCount - a.bookmarkCount ||
        (args.publishedAtOf(b)?.getTime() ?? 0) -
          (args.publishedAtOf(a)?.getTime() ?? 0),
    );
    return {
      data: ranked.slice(args.offset, args.offset + args.limit),
      pagination: createPaginationMeta(args.page, args.limit, ranked.length),
      facets,
    };
  }

  const rows = await args.fetchPage();
  const meta = await getCollectionSubtreeMeta(rows.map((row) => row.id));
  return {
    data: enrich(rows, meta),
    pagination: createPaginationMeta(args.page, args.limit, args.total),
    facets,
  };
}
