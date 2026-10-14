/**
 * Usernames are public URL segments (`/u/:username`), so they must be
 * URL-safe, lower-case and must not collide with app routes.
 */
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;
/**
 * How many numbered fallbacks to try (`alice`, `alice_2`, … `alice_200`)
 * before falling back to a random suffix.
 */
const MAX_CANDIDATES = 200;
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

/** App routes and reserved words a username must never shadow. */
export const RESERVED_USERNAMES = new Set([
  "u",
  "share",
  "explore",
  "login",
  "signin",
  "sign-up",
  "sign-in",
  "signup",
  "logout",
  "signout",
  "settings",
  "account",
  "profile",
  "dashboard",
  "collections",
  "bookmarks",
  "tags",
  "search",
  "api",
  "og",
  "admin",
  "about",
  "help",
  "support",
  "static",
  "assets",
  "public",
  "favicon",
]);

/** Returns an error message, or undefined when the username is acceptable. */
export function validateUsername(value: string): string | undefined {
  if (!USERNAME_PATTERN.test(value)) {
    return "Usernames are 3–30 characters and may contain lowercase letters, numbers and underscores.";
  }
  if (RESERVED_USERNAMES.has(value)) {
    return "That username is reserved.";
  }
  return undefined;
}

/**
 * Turn a display name into the longest valid username it can produce.
 * Returns "" when the name has too little usable material ("Jo", "🎉").
 *
 * Deliberately pure and side-effect free — the auto-assignment path tries a
 * ranked list of candidates against the database rather than trusting one guess.
 */
export function slugifyUsername(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, MAX_USERNAME_LENGTH)
    .replace(/^_+|_+$/g, "")
    // Slicing can leave a trailing separator; drop it before the length check so
    // "verylongname…" does not become "verylongnam_".
    .replace(/_+$/g, "");
  // "RL" slugs to "rl", which is under the minimum. The 0010 migration applies
  // the same rule so a backfilled account and a fresh signup behave alike.
  return slug.length >= MIN_USERNAME_LENGTH ? slug : "";
}

/**
 * Ranked fallbacks for auto-assigning a username, most-preferred first:
 * `alice`, `alice_2`, `alice_3`, … Reserved words are skipped so a user named
 * "Admin" lands on `admin_2` rather than colliding with a route.
 *
 * A numeric suffix is the right choice over a random one: the owner can see
 * what happened and claim something nicer later.
 */
export function usernameCandidates(name: string): string[] {
  const slug = slugifyUsername(name);
  const root = slug || "user";
  const candidates: string[] = [];
  // A wide range, because the realistic worst case is many accounts sharing a
  // display name — every signup called "Test User" lands on the same root. The
  // caller only ever walks this list until one insert succeeds.
  for (let i = 1; i <= MAX_CANDIDATES; i++) {
    const suffix = i === 1 ? "" : `_${i}`;
    const stem = root
      .slice(0, MAX_USERNAME_LENGTH - suffix.length)
      .replace(/_+$/g, "");
    if (stem.length < MIN_USERNAME_LENGTH) break;
    const candidate = `${stem}${suffix}`;
    if (!RESERVED_USERNAMES.has(candidate)) candidates.push(candidate);
  }
  return candidates;
}

/**
 * Last-resort candidate: the slug plus a short random suffix.
 *
 * Numbered suffixes stop being predictable once a name is genuinely popular,
 * and `user_1` … `user_500` is both ugly and unbounded. This is only reached
 * after every numbered candidate is taken, and the caller changes it in
 * settings, so legibility matters less than never failing a signup.
 */
export function randomUsernameCandidate(name: string): string {
  const slug = slugifyUsername(name) || "user";
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const stem = slug
      .slice(0, MAX_USERNAME_LENGTH - suffix.length - 1)
      .replace(/_+$/g, "");
    if (stem.length < MIN_USERNAME_LENGTH) continue;
    const candidate = `${stem}_${suffix}`;
    if (!RESERVED_USERNAMES.has(candidate)) return candidate;
  }
  // Unreachable in practice: a 5-character base36 suffix has ~60M values.
  return `user_${Date.now().toString(36)}`;
}
