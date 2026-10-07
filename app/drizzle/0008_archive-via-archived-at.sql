-- Phase 2 §3.2: "Archived" stops being a collection.
--
-- Move every archived bookmark onto `bookmarks.archived_at`, keep where it
-- really belonged (re-home to Unsorted so it stays listable), then delete the
-- Archived system collection. Both the legacy FK and the new membership table
-- are handled, so a bookmark archived after the backfill (legacy only) is not
-- missed.

-- 1. Mark archived bookmarks, by membership or by legacy FK.
UPDATE "bookmarks" b SET "archived_at" = now()
WHERE b."id" IN (
  SELECT ci."bookmark_id" FROM "collection_items" ci
  JOIN "collections" c ON c."id" = ci."collection_id"
  WHERE c."is_system" = true AND c."slug" = 'archived'
)
OR b."collection_id" IN (
  SELECT c."id" FROM "collections" c
  WHERE c."is_system" = true AND c."slug" = 'archived'
);
--> statement-breakpoint

-- 2. Re-home the legacy FK to Unsorted before the collection disappears
--    (the FK would otherwise set the column to NULL).
UPDATE "bookmarks" b SET "collection_id" = u."id"
FROM "collections" ar
JOIN "collections" u ON u."user_id" = ar."user_id"
                   AND u."slug" = 'unsorted' AND u."is_system" = true
WHERE b."collection_id" = ar."id"
  AND ar."is_system" = true AND ar."slug" = 'archived';
--> statement-breakpoint

-- 3. Re-home membership rows the same way.
UPDATE "collection_items" ci SET "collection_id" = u."id"
FROM "collections" ar
JOIN "collections" u ON u."user_id" = ar."user_id"
                   AND u."slug" = 'unsorted' AND u."is_system" = true
WHERE ci."collection_id" = ar."id"
  AND ar."is_system" = true AND ar."slug" = 'archived';
--> statement-breakpoint

-- 4. Remove the Archived collection (nothing points at it now).
DELETE FROM "collections" WHERE "is_system" = true AND "slug" = 'archived';
