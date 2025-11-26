import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index";
import * as schema from "../db/schema";
import Elysia from "elysia";
import { UnauthorizedError } from "../error";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL as string, // this might look unnecessary but it's required
  emailAndPassword: { enabled: true },
  trustedOrigins: [process.env.CLIENT_URL as string],
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
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
  session: { expiresIn: 60 * 60 * 24 * 7 }, // 7 days
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
                icon: "📥",
              },
              {
                userId: user.id,
                name: "Archived",
                slug: "archived",
                isSystem: true,
                icon: "🗄️",
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

export const requireAuth = new Elysia({ name: "requireAuth" })
  .derive<{ userId: string }>(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }
    return { userId: session.user.id };
  })
  //@ts-ignore duck tapping a middleware
  .as("requireAuth");
