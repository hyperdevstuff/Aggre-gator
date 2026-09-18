-- Backfill bookmarks orphaned by pre-fix collection deletes
-- (DELETE set collection_id = NULL with no re-homing). Re-home each orphan
-- to its owner's Unsorted system collection so it is listable again.
UPDATE "bookmarks" SET "collection_id" = "u"."id"
FROM "collections" "u"
WHERE "bookmarks"."collection_id" IS NULL
  AND "u"."user_id" = "bookmarks"."user_id"
  AND "u"."slug" = 'unsorted'
  AND "u"."is_system" = true;
