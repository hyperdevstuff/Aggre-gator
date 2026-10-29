-- Wave 2, step 6 — view counts.
--
-- A simple counter on `collections.view_count`, incremented whenever a
-- collection is served to a reader. This is the data source for both the
-- analytics endpoints (be-16) and the `sort=top` ranking upgrade (be-17).
--
-- be-15 adds a detailed `share_views` table (referrer, day bucket) on top of
-- this for the analytics dashboard; the counter here is the cheap, always-
-- available aggregate that ranking can read without a join.
--
-- Incrementing is fire-and-forget from the request path: a lost increment on
-- a sleeping free-tier instance is acceptable (it is a counter, not money),
-- and blocking the response on a write would slow every page view.

ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;