import { Elysia, t } from "elysia";
import { auth, betterAuthPlugin } from "../utils/auth";
import { db } from "../db";
import { bookmarks, collections, tags, user as users } from "../db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { ConflictError } from "../error";
import { validateUsername } from "../utils/username";

export const userRouter = new Elysia({ prefix: "/user" })
  .use(betterAuthPlugin)
  .get("/me", async ({ user }) => {
    // Read the row rather than the better-auth session user: the session object
    // only knows better-auth's own fields and drops `username`/`bio`/`avatar`.
    const [profile] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    return profile;
  })
  .get("/stats", async ({ user }) => {
    const userId = user.id;
    // Three independent counts. The previous single query joined bookmarks ×
    // collections × tags, so each row was counted once per cross-product
    // member, and a user with no bookmarks reported 0 collections and 0 tags.
    const [bookmarkRows, collectionRows, tagRows] = await Promise.all([
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(bookmarks)
        .where(eq(bookmarks.userId, userId)),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(collections)
        .where(eq(collections.userId, userId)),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(tags)
        .where(eq(tags.userId, userId)),
    ]);

    return {
      bookmarks: bookmarkRows[0]?.count ?? 0,
      collections: collectionRows[0]?.count ?? 0,
      tags: tagRows[0]?.count ?? 0,
    };
  })

  .patch(
    "/profile",
    async ({ body, request, user }) => {
      const userId = user.id;

      // Username is the public identity: validate format/reserved words and
      // enforce case-insensitive uniqueness before touching anything.
      if (body.username !== undefined) {
        const error = validateUsername(body.username);
        if (error) throw new ConflictError(error);
        const [taken] = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              sql`lower(${users.username}) = ${body.username.toLowerCase()}`,
              ne(users.id, userId),
            ),
          )
          .limit(1);
        if (taken) throw new ConflictError("That username is already taken.");
      }

      const authChanges: { name?: string; image?: string } = {};
      if (body.name !== undefined) authChanges.name = body.name;
      if (body.image !== undefined) authChanges.image = body.image;
      if (Object.keys(authChanges).length > 0) {
        await auth.api.updateUser({ headers: request.headers, body: authChanges });
      }

      // Custom identity fields managed here, never through better-auth — and
      // `plan` is deliberately not writable by the user.
      const changes: Partial<{ username: string; bio: string; avatar: string }> = {};
      if (body.username !== undefined) changes.username = body.username;
      if (body.bio !== undefined) changes.bio = body.bio;
      if (body.avatar !== undefined) changes.avatar = body.avatar;
      if (Object.keys(changes).length > 0) {
        await db.update(users).set(changes).where(eq(users.id, userId));
      }

      const [profile] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return profile;
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        image: t.Optional(t.String({ format: "uri", maxLength: 1000 })),
        username: t.Optional(t.String({ minLength: 3, maxLength: 30 })),
        bio: t.Optional(t.String({ maxLength: 500 })),
        avatar: t.Optional(t.String({ format: "uri", maxLength: 1000 })),
      }),
    },
  );
