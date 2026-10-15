-- Phase 4b — full-text search columns and indexes.
--
-- Replaces the `ILIKE '%q%'` scans on the public directory and the private
-- `/search` with tsvector matching. The columns are GENERATED ALWAYS STORED, so
-- Postgres keeps them current on every insert/update and the GIN indexes stay
-- usable without an application-side write path.
--
-- `to_tsvector` is only immutable when the configuration is named explicitly
-- (the two-argument form), which is what makes it legal in a generated
-- expression. The bare one-argument form depends on `default_text_search_config`
-- and is not.
--
-- These columns deliberately do not appear in `src/db/schema.ts`: this repo's
-- hand-written migrations (0007, 0008, 0010) live outside drizzle-kit's
-- snapshot lineage, and queries reach the columns through raw SQL fragments.

ALTER TABLE "collections" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("name", '') || ' ' || coalesce("description", ''))
  ) STORED;
--> statement-breakpoint

CREATE INDEX "collections_search_vector_idx" ON "collections" USING GIN ("search_vector");
--> statement-breakpoint

ALTER TABLE "bookmarks" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("domain", ''))
  ) STORED;
--> statement-breakpoint

CREATE INDEX "bookmarks_search_vector_idx" ON "bookmarks" USING GIN ("search_vector");
--> statement-breakpoint

-- Tag names are searched far more often by prefix ("reac" -> "react") than by
-- inflection, and tags are short enough that an expression index beats adding a
-- third generated column.
CREATE INDEX "tags_name_fts_idx" ON "tags" USING GIN (to_tsvector('english', "name"));
