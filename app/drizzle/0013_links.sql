-- Wave 2, step 2 — the shared `links` table.
--
-- A `links` row is the shared preview for a URL: title, description, cover and
-- a maintained `save_count`. Bookmarks point at it through `bookmarks.link_id`
-- (nullable for now, so existing rows survive the migration without a backfill).
--
-- `url_key` is the normalised form produced by `normalizeUrl()` (be-09). It is
-- indexed but **not unique** yet: be-10 only detects near-duplicates and offers
-- a soft prompt. Promoting it to unique is be-11's job, once save-someone-
-- else's-link actually creates rows. A soft false positive costs a dismissed
-- toast; a hard one costs a lost bookmark (ADR-001).
--
-- Nothing here enforces uniqueness or maintains `save_count` — that is
-- deliberately be-11's responsibility, so that the migration stays additive and
-- the schema can land without the write path that populates it.

CREATE TABLE IF NOT EXISTS "links" (
  "id" text PRIMARY KEY NOT NULL,
  "url" text NOT NULL,
  "url_key" text NOT NULL,
  "domain" text,
  "title" text,
  "description" text,
  "cover" text,
  "save_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "links_url_key_idx" ON "links" ("url_key");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "links_url_idx" ON "links" ("url");
--> statement-breakpoint

-- Nullable during migration: existing bookmarks have no link yet, and be-11 is
-- what backfills them. `ON DELETE SET NULL` means deleting a link never orphans
-- a bookmark — it just reverts to a per-user row.
ALTER TABLE "bookmarks" ADD COLUMN IF NOT EXISTS "link_id" text REFERENCES "links"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "bookmarks_link_id_idx" ON "bookmarks" ("link_id");