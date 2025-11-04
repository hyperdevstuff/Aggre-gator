import Elysia, { t } from "elysia";
import { auth } from "../utils/auth";
import { db } from "../db";
import { collections } from "../db/schema";

import { and, eq, isNull } from "drizzle-orm";
import { NotFoundError, UnauthorizedError } from "../error";

export const collectionRouter = new Elysia({ prefix: "/collections" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new UnauthorizedError();
    if (!session?.user?.id) throw new UnauthorizedError();
    return { userId: session.user.id };
  })
  .post(
    "/",
    async ({ body, userId }) => {
      const [collection] = await db
        .insert(collections)
        .values({ ...body, userId })
        .returning();
      return collection;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        parentId: t.Optional(t.String()),
      }),
    },
  )
  .get("/", async ({ userId }) => {
    return db
      .select()
      .from(collections)
      .where(and(eq(collections.userId, userId), isNull(collections.parentId)));
  })
  .get("/:id", async ({ params: { id }, userId }) => {
    const [col] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);
    if (!col) throw new NotFoundError();
    return col;
  })
  .patch(
    "/:id",
    async ({ params: { id }, userId, body }) => {
      const [col] = await db
        .update(collections)
        .set(body)
        .where(and(eq(collections.id, id), eq(collections.userId, userId)))
        .returning();
      if (!col) throw new NotFoundError();
      return col;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        description: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        color: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params: { id }, userId }) => {
      const [col] = await db
        .delete(collections)
        .where(and(eq(collections.id, id), eq(collections.userId, userId)))
        .returning();
      if (!col) throw new NotFoundError();
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get("/:id/children", async ({ params: { id }, userId }) => {
    return db
      .select()
      .from(collections)
      .where(and(eq(collections.userId, userId), eq(collections.parentId, id)));
  });
