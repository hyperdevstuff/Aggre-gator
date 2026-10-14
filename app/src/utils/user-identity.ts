import { inArray, sql, type SQL } from "drizzle-orm";
import { user as users } from "../db/schema";
import { usernameCandidates } from "./username";
import type { DbOrTx } from "./collections";

/**
 * Case-insensitive username predicate for the public `/u/:username` routes, so
 * `/u/Alice` and `/u/alice` resolve to the same account. Served directly by the
 * `user_username_unique` expression index.
 */
export function usernameEq(candidate: string): SQL {
  return sql`lower(${users.username}) = ${candidate.toLowerCase()}`;
}

/**
 * The first auto-assignment candidate nobody has taken, or undefined when every
 * candidate is spoken for.
 *
 * Candidates are already lower-case by construction, which is what both
 * `user_username_unique` (an index on `lower(username)`) and better-auth's
 * `WHERE username = $1` availability lookup expect.
 *
 * Call this from a `create.before` hook so the username becomes part of the
 * INSERT and is present on the object sign-up returns. That does not make the
 * read-then-write atomic: two accounts signing up with the same display name in
 * the same instant can both see a free candidate, and the unique index rejects
 * the loser. The window is sub-millisecond and needs identical names, and the
 * loser retries — which is why the candidate list is long rather than a single
 * guess.
 */
export async function findAvailableUsername(
  dbOrTx: DbOrTx,
  seed: string,
): Promise<string | undefined> {
  const candidates = usernameCandidates(seed);
  if (candidates.length === 0) return undefined;
  // One query for all candidates rather than one per guess.
  const taken = await dbOrTx
    .select({ username: users.username })
    .from(users)
    .where(inArray(users.username, candidates));
  const takenSet = new Set(taken.map((row) => row.username));
  return candidates.find((candidate) => !takenSet.has(candidate));
}