import { and, eq, inArray } from "drizzle-orm";
import Elysia, { NotFoundError, t } from "elysia";
import { db } from "../db";
import { bookmarks, collections } from "../db/schema";
import { requireAuth } from "../utils/auth";

// TODO: add bulk operations as now client is quite ready
// PERF: improve bulk ops
export const bookmarksBulkRouter = new Elysia()
  .use(requireAuth) // TEMP: create better middleware with beforeHandle
  .post(
    "/bulk",
    async ({ body, userId }) => {
      const results = await Promise.allSettled(
        body.bookmarks.map(async (bmk) => {
          const existing = await db
            .select()
            .from(bookmarks)
            .where(
              and(eq(bookmarks.userId, userId), eq(bookmarks.url, bmk.url)),
            )
            .limit(1);

          if (existing.length > 0) {
            return { status: "skipped", url: bmk.url, reason: "duplicated" };
          }

          const collectionId =
            bmk.collectionId ??
            (
              await db
                .select({ id: collections.id })
                .from(collections)
                .where(
                  and(
                    eq(collections.userId, userId),
                    eq(collections.slug, "unsorted"),
                  ),
                )
                .limit(1)
            )[0]?.id;

          const [bookmark] = await db
            .insert(bookmarks)
            .values({
              url: bmk.url,
              note: bmk.note,
              collectionId,
              userId,
              domain: new URL(bmk.url).hostname,
              isFavorite: bmk.isFavorite ?? false,
              title: bmk.title || new URL(bmk.url).hostname,
              description: bmk.description || null,
              cover: bmk.cover || null,
            })
            .returning();
          return { status: "created", bookmark };
        }),
      );

      const created = results.filter(
        (r) => r.status === "fulfilled" && r.value.status === "created",
      );
      const skipped = results.filter(
        (r) => r.status === "fulfilled" && r.value.status === "skipped",
      );
      const failed = results.filter((r) => r.status === "rejected");

      return {
        created: created.length,
        skipped: skipped.length,
        failed: failed.length,
        details: results,
      };
    },
    {
      body: t.Object({
        bookmarks: t.Array(
          t.Object({
            url: t.String({ format: "uri" }),
            title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
            description: t.Optional(t.String({ maxLength: 2000 })),
            cover: t.Optional(t.String({ format: "uri", maxLength: 1000 })),
            note: t.Optional(t.String()),
            isFavorite: t.Optional(t.Boolean()),
            collectionId: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )
  .patch(
    "/bulk",
    async ({ body, userId }) => {
      const results = await Promise.allSettled(
        body.updates.map(async (update) => {
          const [bookmark] = await db
            .update(bookmarks)
            .set(update.data)
            .where(
              and(eq(bookmarks.id, update.id), eq(bookmarks.userId, userId)),
            )
            .returning();

          if (!bookmark) {
            return { status: "failed", id: update.id, reason: "not found" };
          }
          return { status: "updated", bookmark };
        }),
      );

      const updated = results.filter(
        (r) => r.status === "fulfilled" && r.value.status === "updated",
      );

      const failed = results.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && r.value.status === "failed"),
      );

      return {
        updated: updated.length,
        failed: failed.length,
        details: results,
      };
    },
    {
      body: t.Object({
        updates: t.Array(
          t.Object({
            id: t.String(),
            data: t.Object({
              url: t.String({ format: "uri" }),
              title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
              description: t.Optional(t.String({ maxLength: 2000 })),
              cover: t.Optional(t.String({ format: "uri", maxLength: 1000 })),
              note: t.Optional(t.String()),
              isFavorite: t.Optional(t.Boolean()),
              collectionId: t.Optional(t.String()),
            }),
          }),
        ),
      }),
    },
  )
  .post(
    "/bulk/archive",
    async ({ body, userId }) => {
      const archivedId = (
        await db
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.userId, userId),
              eq(collections.slug, "archived"),
            ),
          )
          .limit(1)
      )[0]?.id;

      if (!archivedId) throw new NotFoundError("archived collection not found");

      const results = await db
        .update(bookmarks)
        .set({ collectionId: archivedId })
        .where(
          and(eq(bookmarks.userId, userId), inArray(bookmarks.id, body.ids)),
        )
        .returning({ id: bookmarks.id });

      return { archived: results.length, ids: results.map((r) => r.id) };
    },
    {
      body: t.Object({
        ids: t.Array(t.String(), { minItems: 1 }),
      }),
    },
  );
