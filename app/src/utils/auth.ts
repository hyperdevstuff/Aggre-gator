import { betterAuth } from "better-auth";
import { openAPI, username } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index";
import * as schema from "../db/schema";
import { env } from "../env";
import Elysia from "elysia";
import { InternalError, UnauthorizedError } from "../error";
import { validateUsername } from "./username";
import { findAvailableUsername } from "./user-identity";

const isProduction = env.NODE_ENV === "production";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }) => {
      // TODO: replace with real email provider (Resend, unosend) for production
      console.log(`\n🔑 Password reset requested for ${user.email}`);
      console.log(`   Reset URL: ${url}`);
      console.log(`   Token: ${token}\n`);
    },
  },
  trustedOrigins: [env.CLIENT_URL],
  plugins: [
    openAPI(),
    // The plugin owns the `username` column's normalisation and its uniqueness
    // rules. Our column is nullable + uniquely indexed on `lower(username)`,
    // which is exactly what the plugin expects, so there is no schema change.
    //
    // `displayUsername: false` because `user.name` is already the display name;
    // the plugin's separate field would just be a second source of truth.
    //
    // `post-normalization` matters: with the default `pre` order the validator
    // sees the raw input, so "Alice" is rejected by our lower-case-only pattern
    // before it is ever normalized. Post-order normalizes first, so the user can
    // type "Alice" and end up at /u/alice.
    username({
      displayUsername: false,
      minUsernameLength: 3,
      maxUsernameLength: 30,
      validationOrder: { username: "post-normalization" },
      // Case-insensitive on purpose. better-auth's `signInUsername` only
      // normalizes its input when the order is literally "pre-normalization",
      // so under post-order it looks the account up with the *raw* string. A
      // case-sensitive validator would reject "SIO_123" outright and make
      // username sign-in case-sensitive — a real usability bug for a field
      // people type from memory. Normalization lower-cases before the lookup,
      // so accepting mixed case here is safe.
      //
      // Reserved words and the format rule live in one place, and the auth layer
      // enforces them for every caller — not just our profile route.
      usernameValidator: (value) =>
        validateUsername(value.toLowerCase()) === undefined,
    }),
  ],
  // better-auth's own limiter is production-only by default, and the global
  // Elysia limiter exempts `/api/auth` entirely — so without this there is no
  // cap on credential endpoints in dev/test at all.
  //
  // better-auth's built-in special rule is 3 requests / 10s on /sign-in* and
  // /sign-up*. That is tight enough to be hostile: signing up from two tabs, or
  // behind a shared office IP, trips it. 10 / 60s still caps credential stuffing
  // while tolerating a real person mistyping a password a few times.
  //
  // The integration suite creates and authenticates dozens of accounts, so the
  // limit is disabled under NODE_ENV=test rather than worked around in tests.
  rateLimit: isProduction
    ? {
        enabled: true,
        customRules: {
          "/sign-in/username": { window: 60, max: 10 },
          "/sign-in/email": { window: 60, max: 10 },
          "/sign-up/email": { window: 60, max: 10 },
        },
      }
    : { enabled: false },
  advanced: {
    // Deterministic secure cookies in production (env validation already
    // requires https origins there). better-auth would infer this from the
    // baseURL protocol, but explicit beats inferred for session security.
    useSecureCookies: isProduction,
  },
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
      socialProviders: {
        google: {
          prompt: "select_account",
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      },
    }
    : {}),
  session: { expiresIn: 60 * 60 * 24 * 7 },
  databaseHooks: {
    user: {
      create: {
        // Assign in `before`, not `after`: the value is then part of the INSERT,
        // so the user object returned from sign-up already carries the username
        // instead of reporting `null` until the next fetch.
        before: async (user) => {
          try {
            const username = await findAvailableUsername(db, user.name);
            if (!username) {
              throw new Error(
                `no username candidate could be derived from "${user.name}"`,
              );
            }
            return { data: { ...user, username } };
          } catch (error) {
            console.error(
              `[auth] failed to assign a username for new user:`,
              error,
            );
            throw new InternalError(
              "Could not finish creating your account. Please try again.",
            );
          }
        },
        after: async (user) => {
          try {
            await db.insert(schema.collections).values({
              userId: user.id,
              name: "Unsorted",
              slug: "unsorted",
              isSystem: true,
            });
          } catch (error) {
            // A user without the Unsorted collection cannot use the product:
            // every default save would fail its collection lookup. Fail the
            // signup loudly and with the real cause rather than reporting it
            // as a 401, which told users their credentials were wrong.
            console.error(
              `[auth] failed to provision system collections for user ${user.id}:`,
              error,
            );
            throw new InternalError(
              "Could not finish creating your account. Please try again.",
            );
          }
        },
      },
    },
  },
});

/**
 * Route prefixes that are public by design and must answer anonymous requests:
 * a shared collection page is meant to be readable without an account.
 *
 * Because `betterAuthPlugin` is registered `.as("global")`, its `derive` runs
 * for every route in the app, so public routes have to opt out explicitly here.
 */
const PUBLIC_PREFIXES = ["/share", "/u", "/og"];

function isPublicPath(path: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export const betterAuthPlugin = new Elysia({ name: "better-auth" })
  .derive<{ user: typeof auth.$Infer.Session.user; session: typeof auth.$Infer.Session.session }>(
    async ({ request, path }) => {
      // Public routes carry no `user`/`session`. The router that owns them must
      // not read either field — see `share/index.ts`.
      if (isPublicPath(path)) {
        return {} as {
          user: typeof auth.$Infer.Session.user;
          session: typeof auth.$Infer.Session.session;
        };
      }

      const session = await auth.api.getSession({ headers: request.headers });

      if (!session) {
        throw new UnauthorizedError();
      }

      return {
        user: session.user,
        session: session.session,
      };
    },
  )
  .as("global");
