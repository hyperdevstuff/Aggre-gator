ALTER TABLE "bookmarks" DROP CONSTRAINT "bookmarks_collection_id_collections_id_fk";
--> statement-breakpoint
DROP INDEX "bookmarks_collection_id_idx";--> statement-breakpoint
ALTER TABLE "bookmarks" DROP COLUMN "collection_id";