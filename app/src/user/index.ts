import { Elysia, t } from "elysia";
import { auth, betterAuthPlugin } from "../utils/auth";
import { db } from "../db";
import { bookmarks, collections, tags, user as users, follows } from "../db/schema";
import { and, eq, ne, sql, desc } from "drizzle-orm";
import { ConflictError, NotFoundError } from "../error";
import { validateUsername } from "../utils/username";
import { createPaginationMeta, normalizePagination } from "../utils/pagination";

/**
 * better-auth signals username problems with a machine code (`APIError.body.code`).
 * Our own pre-check already produces a friendlier message for the common cases,
 * so this only has to cover what the plugin can reject that we do not model.
 */
function usernameErrorMessage(error: unknown): string {
  const code = (error as { body?: { code?: string } } | null)?.body?.code;
  switch (code) {
    case "USERNAME_IS_ALREADY_TAKEN":
      return "That username is already taken.";
    case "USERNAME_TOO_SHORT":
    case "USERNAME_TOO_LONG":
    case "INVALID_USERNAME":
      return "Usernames are 3–30 characters and may contain lowercase letters, numbers and underscores.";
    case "USERNAME_IS_IMMUTABLE":
      return "Your username can no longer be changed.";
    default:
      return "Could not update your username. Please try again.";
  }
}

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

      // Username is the public identity. Check it here for a readable message,
      // then let the `username()` plugin be the authority on normalisation and
      // uniqueness — it is the same code path sign-up uses, so two concurrent
      // profile edits cannot race a duplicate past us.
      if (body.username !== undefined) {
        // Validate the post-normalisation form to match the plugin's
        // `validationOrder: "post-normalization"`, so "Alice" is accepted and
        // stored as `alice` instead of being rejected for its capitals.
        const error = validateUsername(body.username.toLowerCase());
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

      // Everything better-auth owns goes through its API, including `username`
      // now that the plugin manages the column.
      const authChanges: {
        name?: string;
        image?: string;
        username?: string;
      } = {};
      if (body.name !== undefined) authChanges.name = body.name;
      if (body.image !== undefined) authChanges.image = body.image;
      if (body.username !== undefined) authChanges.username = body.username;
      if (Object.keys(authChanges).length > 0) {
        try {
          await auth.api.updateUser({ headers: request.headers, body: authChanges });
        } catch (error) {
          // The pre-check above normally catches this first, so getting here
          // means the plugin rejected it for a reason we did not model — a race,
          // or a rule it enforces beyond ours. Surface it as a 409, not a 500.
          throw new ConflictError(usernameErrorMessage(error));
        }
      }

      // Custom identity fields managed here, never through better-auth — and
      // `plan` is deliberately not writable by the user.
      const changes: Partial<{ bio: string; avatar: string }> = {};
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
  )

  // --- Follows ---

  .post(
    "/:id/follow",
    async ({ params: { id: targetId }, user }) => {
      const followerId = user.id;
      if (followerId === targetId) {
        throw new ConflictError("You cannot follow yourself.");
      }
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1);
      if (!target) throw new NotFoundError("User not found.");

      await db
        .insert(follows)
        .values({ followerId, followingId: targetId })
        .onConflictDoNothing();
      return { following: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
    },
  )

  .delete(
    "/:id/follow",
    async ({ params: { id: targetId }, user }) => {
      const followerId = user.id;
      await db
        .delete(follows)
        .where(
          and(
            eq(follows.followerId, followerId),
            eq(follows.followingId, targetId),
          ),
        );
      return { following: false };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
    },
  )

  .get(
    "/:id/followers",
    async ({ params: { id: targetId }, query }) => {
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      const [data, [{ count }]] = await Promise.all([
        db
          .select({
            id: users.id,
            username: users.username,
            name: users.name,
            avatar: users.avatar,
            image: users.image,
            followedAt: follows.createdAt,
          })
          .from(follows)
          .innerJoin(users, eq(users.id, follows.followerId))
          .where(eq(follows.followingId, targetId))
          .orderBy(desc(follows.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(follows)
          .where(eq(follows.followingId, targetId)),
      ]);

      return {
        data,
        pagination: createPaginationMeta(page, limit, Number(count)),
      };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
    },
  )

  .get(
    "/:id/following",
    async ({ params: { id: targetId }, query }) => {
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      const [data, [{ count }]] = await Promise.all([
        db
          .select({
            id: users.id,
            username: users.username,
            name: users.name,
            avatar: users.avatar,
            image: users.image,
            followedAt: follows.createdAt,
          })
          .from(follows)
          .innerJoin(users, eq(users.id, follows.followingId))
          .where(eq(follows.followerId, targetId))
          .orderBy(desc(follows.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(follows)
          .where(eq(follows.followerId, targetId)),
      ]);

      return {
        data,
        pagination: createPaginationMeta(page, limit, Number(count)),
      };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
    },
  )

  .get(
    "/:id/follow-status",
    async ({ params: { id: targetId }, user }) => {
      const [row] = await db
        .select({ createdAt: follows.createdAt })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, user.id),
            eq(follows.followingId, targetId),
          ),
        )
        .limit(1);
      return { following: !!row };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
    },
  );
