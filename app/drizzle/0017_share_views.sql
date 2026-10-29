-- Wave 3, step 1 — detailed per-view log for the analytics dashboard.
--
-- `collections.view_count` (be-14) is the cheap aggregate used for ranking and
-- for the headline number. This table is the audit trail behind it: one row
-- per page view that arrives through a share link, carrying the share row, the
-- referrer (origin only, see below), the timestamp, and a pre-computed day
-- bucket so the views/day query can group without a date_trunc per row.
--
-- FK target is `shared_collections`, NOT `collections`: a share row is what
-- makes a collection reachable by link, and revoking/deleting a share should
-- drop its analytics with it rather than leaving rows pointing at a collection
-- that is no longer public. Direct `/u/:username/:slug` views are NOT logged
-- here — they still bump `collections.view_count`, but they have no share row
-- and so no detailed record. Unique-visitor counts are deliberately out of
-- scope for v1: no IP (raw or hashed) is stored, and this table must not grow
-- an IP column "for debugging" later. If unique visitors are ever needed, add
-- a salt-rotated hash column at that time — it cannot be backfilled.
--
-- Referrer is normalised to origin (scheme + host) at insert time so that
-- paths are never stored across sites; origin is all the referrer breakdown
-- (be-16) needs.
--
-- Indexes: (share_id, day_bucket) for the views/day series, and share_id
-- alone for referrer breakdowns.

CREATE TABLE IF NOT EXISTS "share_views" (
  "id" text PRIMARY KEY NOT NULL,
  "share_id" text NOT NULL REFERENCES "shared_collections"("id") ON DELETE CASCADE,
  "referrer" text,
  "viewed_at" timestamp DEFAULT now() NOT NULL,
  "day_bucket" date NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "share_views_share_day_idx" ON "share_views" ("share_id", "day_bucket");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "share_views_share_idx" ON "share_views" ("share_id");
