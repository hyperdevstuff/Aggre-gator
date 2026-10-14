-- Phase 3 PR 1 — public identity backfill + the Explore index.
--
-- Two things have to be true before `/u/:username` can serve anybody:
--
--   1. every existing account has a username, and
--   2. every stored username is lower-case.
--
-- (2) is not cosmetic. better-auth's `username` plugin looks availability up
-- with `WHERE username = $1` against the *normalized* value, so a stored
-- "Alice" would be invisible to a check for "alice". The check would pass, the
-- write would proceed, and `user_username_unique` (which indexes `lower()`)
-- would reject it as a raw 23505 instead of a clean USERNAME_IS_ALREADY_TAKEN.

-- 1. Give every account without a username a unique one.
--
--    The numbering is computed over the *existing* usernames as well as the new
--    ones, so this is unique by construction in a single statement. Doing it as
--    two passes — backfill, then de-duplicate — cannot work: Postgres checks the
--    unique index per row during the UPDATE, so a backfill that hands two people
--    the same slug fails immediately and never reaches the repair pass.
--
--    Existing usernames sort first within each group, so nobody who already
--    picked a name gets bumped by a newcomer. `left(..., 30)` keeps every value
--    inside USERNAME_MAX_LENGTH.
WITH base AS (
  SELECT u."id",
         u."created_at",
         -- Matches `usernameCandidates()` in app/src/utils/username.ts: a name
         -- that yields nothing usable ("Jo", "🎉", "RL") falls back to `user`.
         -- Note the length test, not just emptiness — "RL" slugs to "rl", which
         -- is below USERNAME_MIN_LENGTH and would fail validation.
         CASE
           WHEN length(
             trim(BOTH '_' FROM left(
               regexp_replace(lower(u."name"), '[^a-z0-9]+', '_', 'g'), 30
             ))
           ) < 3 THEN 'user'
           ELSE trim(BOTH '_' FROM left(
             regexp_replace(lower(u."name"), '[^a-z0-9]+', '_', 'g'), 30
           ))
         END AS slug,
         -- Existing names outrank derived ones; ties break by age, then id, so
         -- the assignment is deterministic across re-runs.
         (u."username" IS NOT NULL) AS claimed
  FROM "user" u
),
numbered AS (
  SELECT "id",
         row_number() OVER (
           PARTITION BY slug
           ORDER BY claimed DESC, "created_at" ASC, "id" ASC
         ) AS n
  FROM base
)
UPDATE "user" u
SET "username" = CASE WHEN x.n = 1 THEN b.slug
                      ELSE left(b.slug || '_' || x.n, 30) END
FROM numbered x
JOIN base b ON b."id" = x."id"
WHERE u."id" = x."id" AND u."username" IS NULL;
--> statement-breakpoint

-- 2. Normalise everything to lower-case.
--
--    Provably collision-free: `user_username_unique` indexes `lower(username)`,
--    so no two non-null usernames already agree case-insensitively. Folding to
--    lower-case therefore cannot create a duplicate.
UPDATE "user"
SET "username" = lower("username")
WHERE "username" IS NOT NULL
  AND "username" <> lower("username");
--> statement-breakpoint

-- 3. Explore reads `WHERE visibility = 'public' ORDER BY published_at DESC`.
--    Partial on public so the index stays small — private collections are the
--    overwhelming majority and are never queried through it.
CREATE INDEX IF NOT EXISTS "collections_public_explore_idx"
  ON "collections" ("published_at" DESC)
  WHERE "visibility" = 'public';