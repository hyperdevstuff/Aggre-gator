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
import { sendPasswordResetEmail, sendVerificationEmail as mailVerificationEmail, mailEnabled } from "./mail";

const isProduction = env.NODE_ENV === "production";

/**
 * One hour, in seconds — the unit better-auth documents for
 * `emailVerification.expiresIn` (it is passed straight to `setExpirationTime`).
 *
 * Stated explicitly rather than left at the default because the templates in
 * `utils/mail.ts` tell the reader the link "expires in an hour". If the default
 * ever changes, the copy is the thing that has to change with it, and this line
 * is where that shows up.
 */
const VERIFICATION_EXPIRES_IN_SECONDS = 60 * 60;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    /**
     * Requiring verification at sign-in is only safe when a verification mail can
     * actually leave the building. With `MAIL_PROVIDER=none` the link is dropped
     * on the floor, so enforcing it would lock out every account permanently —
     * including existing ones, the first time the flag shipped. So the switch is
     * tied to a provider actually being configured, and turning mail on turns
     * this on with it.
     *
     * The *publish* gate in `be-07` is deliberately not tied to this: refusing to
     * publish is recoverable (verify, then publish) and is what actually stops a
     * spam account reaching a public page, so it stays on either way.
     */
    requireEmailVerification: mailEnabled(),
    sendResetPassword: async ({ user, url }) => {
      // The mailer never throws and never logs: a provider outage must not turn
      // a completed "check your inbox" into a 500, and `be-02` established that
      // emails and reset tokens stay out of the logs. What happens instead is a
      // lost email — the endpoint still answers the same generic message, so an
      // attacker learns nothing about whether the address exists either way.
      await sendPasswordResetEmail({ to: user.email, url, name: user.name });
    },
  },
  /**
   * Address verification. `be-06`.
   *
   * `sendOnSignUp` is left implicit on purpose: better-auth defaults it to
   * `requireEmailVerification`, which is `mailEnabled()` — so a sign-up mails
   * exactly when enforcement is on. Naming it would freeze the link between the
   * two and they could drift apart silently.
   *
   * `sendOnSignIn` is the interesting one: it is what makes "wrong password" and
   * "unverified address" recoverable by the person who hit them, instead of
   * leaving a signed-out user staring at a rejection with no next step. Note
   * better-auth refuses sign-in *before* reaching this callback unless
   * `sendVerificationEmail` is configured at all, so the two always travel
   * together.
   */
  emailVerification: {
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: VERIFICATION_EXPIRES_IN_SECONDS,
    sendVerificationEmail: async ({ user, url }) => {
      await mailVerificationEmail({
        to: user.email,
        url,
        name: user.name,
      });
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
