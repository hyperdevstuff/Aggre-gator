import { and, eq, inArray, isNotNull } from "drizzle-orm";


import Elysia, { t } from "elysia";
import { db } from "../db";
import { bookmarks, collectionItems } from "../db/schema";
import { betterAuthPlugin } from "../utils/auth";
import {
  getBookmarkCollectionIds,
  resolveCreateCollections,
  setBookmarkCollections,
} from "../utils/collections";
import { rateLimitGuard } from "../utils/rate-limit";

export const bookmarksBulkRouter = new Elysia()
  .use(betterAuthPlugin)
  .post(
    "/bulk",
    async ({ body, user }) => {
      const userId = user.id;
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

          let collectionIds: string[];
          try {
            collectionIds = await resolveCreateCollections(
              db,
              userId,
              bmk.collectionIds,
            );
          } catch {
            return { status: "failed", url: bmk.url, reason: "collection not found" };
          }

          const [bookmark] = await db
            .insert(bookmarks)
            .values({
              url: bmk.url,
              note: bmk.note,
              userId,
              domain: new URL(bmk.url).hostname,
              isFavorite: bmk.isFavorite ?? false,
              title: bmk.title || new URL(bmk.url).hostname,
              description: bmk.description || null,
              cover: bmk.cover || null,
            })
            .returning();
          await setBookmarkCollections(db, userId, bookmark.id, collectionIds);
          return { status: "created", bookmark: { ...bookmark, collectionIds } };
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
      // One bulk request inserts up to N bookmarks; keeping it well below the
      // per-bookmark create limit stops it from being a way around that cap.
      beforeHandle: rateLimitGuard({ name: "bookmarks:bulk", limit: 20 }),
      body: t.Object({
        bookmarks: t.Array(
          t.Object({
            url: t.String({ format: "uri" }),
            title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
            description: t.Optional(t.String({ maxLength: 2000 })),
            cover: t.Optional(t.String({ format: "uri", maxLength: 1000 })),
            note: t.Optional(t.String()),
            isFavorite: t.Optional(t.Boolean()),
            collectionIds: t.Optional(t.Array(t.String())),
          }),
        ),
      }),
    },
  )
  .patch(
    "/bulk",
    async ({ body, user }) => {
      const userId = user.id;
      const results = await Promise.allSettled(
        body.updates.map(async (update) => {
          const { collectionIds, ...data } = update.data;
          const [bookmark] = await db
            .update(bookmarks)
            .set(data)
            .where(
              and(eq(bookmarks.id, update.id), eq(bookmarks.userId, userId)),
            )
            .returning();

          if (!bookmark) {
            return { status: "failed", id: update.id, reason: "not found" };
          }
          if (collectionIds !== undefined) {
            try {
              await setBookmarkCollections(db, userId, update.id, collectionIds);
            } catch {
              return { status: "failed", id: update.id, reason: "collection not found" };
            }
          }
          const memberships = await getBookmarkCollectionIds(db, [update.id]);
          return {
            status: "updated",
            bookmark: {
              ...bookmark,
              collectionIds: memberships.get(update.id) ?? [],
            },
          };
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
              collectionIds: t.Optional(t.Array(t.String())),
            }),
          }),
        ),
      }),
    },
  )
  .post(
    "/bulk/archive",
    async ({ body, user }) => {
      const userId = user.id;
      const results = await db
        .update(bookmarks)
        .set({ archivedAt: new Date() })
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
  )
  .post(
    "/bulk/unarchive",
    async ({ body, user }) => {
      const userId = user.id;
      const results = await db
        .update(bookmarks)
        .set({ archivedAt: null })
        .where(
          and(eq(bookmarks.userId, userId), inArray(bookmarks.id, body.ids)),
        )
        .returning({ id: bookmarks.id });

      return { unarchived: results.length, ids: results.map((r) => r.id) };
    },
    {
      body: t.Object({
        ids: t.Array(t.String(), { minItems: 1 }),
      }),
    },
  )
  .post(
    "/bulk-delete",
    async ({ body, user }) => {
      const userId = user.id;

      // Only archived bookmarks can be permanently deleted.
      const deleted = await db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, userId),
            isNotNull(bookmarks.archivedAt),
            inArray(bookmarks.id, body.ids),
          ),
        )
        .returning({ id: bookmarks.id });

      const skippedCount = body.ids.length - deleted.length;

      return {
        deleted: deleted.length,
        skipped: skippedCount,
        ids: deleted.map((r) => r.id),
      };
    },
    {
      body: t.Object({
        ids: t.Array(t.String(), { minItems: 1 }),
      }),
    },
  )
  .post(
    "/move",
    async ({ body, user }) => {
      const userId = user.id;

      // An empty set means Unsorted, matching the old null target.
      const targetCollectionIds = await resolveCreateCollections(
        db,
        userId,
        body.collectionIds,
      );

      const owned = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(
          and(eq(bookmarks.userId, userId), inArray(bookmarks.id, body.ids)),
        );
      const ids = owned.map((r) => r.id);

      if (ids.length > 0) {
        await db
          .delete(collectionItems)
          .where(inArray(collectionItems.bookmarkId, ids));
        await db.insert(collectionItems).values(
          targetCollectionIds.flatMap((collectionId) =>
            ids.map((bookmarkId) => ({
              collectionId,
              bookmarkId,
              position: 0,
            })),
          ),
        );
      }

      return { moved: ids.length, ids };
    },
    {
      body: t.Object({
        ids: t.Array(t.String(), { minItems: 1 }),
        collectionIds: t.Array(t.String()),
      }),
    },
  );
