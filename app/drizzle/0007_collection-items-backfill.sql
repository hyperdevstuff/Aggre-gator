-- Backfill: give every bookmark a first `collection_items` row from its legacy
-- `bookmarks.collection_id`, so the membership table starts in sync with the
-- single-FK model. `position` is set to creation order within each collection
-- so the default manual order matches the current created-desc listing once it
-- becomes user-visible.
INSERT INTO "collection_items" ("collection_id", "bookmark_id", "position")
SELECT
  "collection_id",
  "id",
  (ROW_NUMBER() OVER (
    PARTITION BY "collection_id"
    ORDER BY "created_at", "id"
  ) - 1)
FROM "bookmarks"
WHERE "collection_id" IS NOT NULL
ON CONFLICT ("collection_id", "bookmark_id") DO NOTHING;
