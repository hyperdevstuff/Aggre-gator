import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index";
import * as schema from "../db/schema";
import { env } from "../env";
import Elysia from "elysia";
import { InternalError, UnauthorizedError } from "../error";

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
  plugins: [openAPI()],
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
const PUBLIC_PREFIXES = ["/share"];

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
