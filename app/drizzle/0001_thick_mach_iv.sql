ALTER TABLE "collections" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE INDEX "bookmarks_collection_id_idx" ON "bookmarks" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_system_slug_unique" ON "collections" USING btree ("user_id","slug") WHERE "collections"."is_system" = true;