/**
 * Usernames are public URL segments (`/u/:username`), so they must be
 * URL-safe, lower-case and must not collide with app routes.
 */
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
