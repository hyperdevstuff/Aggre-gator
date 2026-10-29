-- Wave 2, step 3 — promote `links.url_key` to unique.
--
-- be-10 created the table with `url_key` indexed but not unique, so duplicate
-- keys could coexist while the save flow did not exist yet. Now that
-- save-someone-else's-link creates and reuses rows, a duplicate key means two
-- `links` rows for the same URL — which is exactly what `save_count` is
-- supposed to count against a single row. Promote the index to a unique
-- constraint.
--
-- Safe because be-10 shipped the table empty: no existing duplicates to
-- resolve. A future backfill that populated `links` before this migration would
-- have had to dedupe first.

CREATE UNIQUE INDEX IF NOT EXISTS "links_url_key_unique" ON "links" ("url_key");