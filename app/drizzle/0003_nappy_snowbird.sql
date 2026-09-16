CREATE TABLE "shared_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"share_code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_collections_share_code_unique" UNIQUE("share_code")
);
--> statement-breakpoint
ALTER TABLE "shared_collections" ADD CONSTRAINT "shared_collections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_collections" ADD CONSTRAINT "shared_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shared_collections_share_code_idx" ON "shared_collections" USING btree ("share_code");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_collections_collection_user_idx" ON "shared_collections" USING btree ("collection_id","user_id");--> statement-breakpoint
CREATE INDEX "shared_collections_user_idx" ON "shared_collections" USING btree ("user_id");