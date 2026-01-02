import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index";
import * as schema from "../db/schema";
import Elysia from "elysia";
import { UnauthorizedError } from "../error";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL as string,
  emailAndPassword: { enabled: true },
  trustedOrigins: [process.env.CLIENT_URL as string],
  plugins: [openAPI()],
  ...(process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
    ? {
      socialProviders: {
        google: {
          prompt: "select_account",
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });

        if (!session) return status(401);

        return {
          user: session.user,
          session: session.session,
        };
      },
    },
  });
