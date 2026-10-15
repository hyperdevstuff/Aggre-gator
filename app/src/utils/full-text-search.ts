import { sql, type SQL } from "drizzle-orm";

/**
 * Full-text match condition for a tsvector column or expression.
 *
 * Two arms, because they cover different queries:
 *
 *  - `websearch_to_tsquery` handles whole words and multi-word input ("grid
 *    layout"), and is safe on arbitrary input — it never raises on syntax.
 *  - `to_tsquery('<last-token>:*')` covers the prefix case ("zepp" finding
 *    "Zeppelin"). `to_tsquery` raises on operator characters, so the token is
 *    stripped to `[a-zA-Z0-9_]` before it reaches the query — the only part of
 *    this condition built from user input outside a bound parameter.
 *
 * Callers pass a blank `q` to nothing: an empty query must not filter.
 */
export function ftsCondition(column: SQL, query: string): SQL {
  const trimmed = query.trim();
  const tokens = trimmed.match(/[a-zA-Z0-9_]+/g);
  const last = tokens ? tokens[tokens.length - 1] : "";

  if (!last) {
    return sql`${column} @@ websearch_to_tsquery('english', ${trimmed})`;
  }
  return sql`(
    ${column} @@ websearch_to_tsquery('english', ${trimmed})
    OR ${column} @@ to_tsquery('english', ${last} || ':*')
  )`;
}
