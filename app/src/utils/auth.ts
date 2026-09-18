import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index";
import * as schema from "../db/schema";
import { env } from "../env";
import Elysia from "elysia";
import { UnauthorizedError } from "../error";

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
            await db.insert(schema.collections).values([
              {
                userId: user.id,
                name: "Unsorted",
                slug: "unsorted",
                isSystem: true,
              },
              {
                userId: user.id,
                name: "Archived",
                slug: "archived",
                isSystem: true,
              },
            ]);
          } catch (error) {
            throw new UnauthorizedError();
          }
        },
      },
    },
  },
});

export const betterAuthPlugin = new Elysia({ name: "better-auth" })
  .derive<{ user: typeof auth.$Infer.Session.user; session: typeof auth.$Infer.Session.session }>(
    async ({ request }) => {
      const session = await auth.api.getSession({ headers: request.headers });

      if (!session) {
        throw new UnauthorizedError();
      }

      return {
        user: session.user,
        session: session.session,
      };
    }
  )
  .as("global");
