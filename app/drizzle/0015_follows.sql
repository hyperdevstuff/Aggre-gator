-- Wave 2, step 5 — follows.
--
-- A follow is a directed edge: follower_id follows following_id. The composite
-- primary key prevents duplicate follows, and the indexes make both directions
-- (who follows me? who do I follow?) cheap. ON DELETE CASCADE on both sides so
-- deleting an account removes its edges in both directions.
CREATE TABLE IF NOT EXISTS "follows" (
  "follower_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "following_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("follower_id", "following_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "follows_following_id_idx" ON "follows" ("following_id");