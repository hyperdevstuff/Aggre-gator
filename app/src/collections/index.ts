import Elysia, { t } from "elysia";
import { betterAuthPlugin, requireVerifiedPublisher } from "../utils/auth";
import { db } from "../db";
import { collections, bookmarks, collectionItems, sharedCollections, user, user as users, type CollectionVisibility } from "../db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { ConflictError, ForbiddenError, NotFoundError } from "../error";
import { generateShareCode } from "../utils/nanoid";
import { createPaginationMeta, normalizePagination } from "../utils/pagination";

import { collectionParentError } from "../../../shared/collection-tree";
import {
  collectionBookmarkCount,
  getSystemCollectionId,
  isInCollection,
  requireUserCollection,
  type DbOrTx,
} from "../utils/collections";

/** Kebab-case slug, e.g. "design-inspiration". */
const SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
/** Six-digit hex color, matching the tag color validation. */
const COLOR_PATTERN = "^#[0-9A-Fa-f]{6}$";

const NO_USERNAME_MESSAGE =
  "Set a username in settings before publishing a collection.";

/** True when `userId` has a username, i.e. owns a public `/u/:name` URL. */
async function requireUsername(dbOrTx: DbOrTx, userId: string): Promise<boolean> {
  const [row] = await dbOrTx
    .select({ username: user.username })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return !!row?.username;
}

/**
 * `be-07`: the publish gate, and it is one predicate for every route that can
 * put a collection in front of an anonymous reader.
 *
 * `private` is the only visibility that stays open — it is the owner's own
 * filing, visible to nobody else, so it is not a publication. `unlisted` is
 * gated too, and that is the call worth being explicit about: it is not
 * indexed, but `/u/:username/:slug` serves any non-private collection to anyone
 * who has the address, and a share code is exactly that address. Gating only
 * `public` would leave the tier a spammer can publish into for free.
 */
function requireVerifiedToPublish(
  user: { emailVerified?: unknown },
  requested: CollectionVisibility | undefined,
) {
  if (requested && requested !== "private") {
    requireVerifiedPublisher(user);
  }
}

/** "Design Inspiration" → "design-inspiration", for an auto-derived slug. */
function slugifyCollectionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

/**
 * Decide a collection's slug and `publishedAt` for a write.
 *
 * The invariants that make a collection publicly addressable:
 *   - `public` requires an owner username (it is the URL segment) and a slug,
 *     derived from the name when not supplied;
 *   - `publishedAt` is stamped on the transition into `public` and cleared when
 *     leaving it, so Explore's ordering and its partial index stay honest.
 */
async function resolveVisibility(
  dbOrTx: DbOrTx,
  input: {
    userId: string;
    requested: CollectionVisibility | undefined;
    /** The slug being written, if the request supplies one. */
    slug?: string;
    /** The collection's current slug, reused when the request omits one. */
    currentSlug?: string | null;
    name: string;
  },
): Promise<{ slug?: string; publishedAt: Date | null }> {
  const { userId, requested, name } = input;
  // Reuse the existing slug rather than re-deriving. Re-deriving would both
  // ignore a slug the owner already set and fail outright when the name
  // slugifies to nothing.
  let slug = input.slug ?? input.currentSlug ?? undefined;

  if (requested === "public") {
    if (!(await requireUsername(dbOrTx, userId))) {
      throw new ConflictError(NO_USERNAME_MESSAGE);
    }
    // Derive when absent. The per-owner unique index on `slug` is the final
    // authority; a derived collision surfaces as a 23505 from the INSERT.
    if (!slug) {
      const derived = slugifyCollectionName(name);
      if (!derived) {
        throw new ConflictError(
          "Give the collection a URL slug before publishing it.",
        );
      }
      const [taken] = await dbOrTx
        .select({ id: collections.id })
        .from(collections)
        .where(and(eq(collections.userId, userId), eq(collections.slug, derived)))
        .limit(1);
      if (taken) {
        throw new ConflictError(
          `The URL "${derived}" is already in use. Choose a different slug.`,
        );
      }
      slug = derived;
    }
    return { slug, publishedAt: new Date() };
  }

  // Private or unlisted: no longer listed, so drop the publication stamp.
  return { slug, publishedAt: null };
}

export const collectionRouter = new Elysia({ prefix: "/collections" })
  .use(betterAuthPlugin)
  .post(
    "/",
    async ({ body, user }) => {
      const userId = user.id;
      // Before the transaction: a refusal is not a write, and there is no reason
      // to take the owner's per-user row lock to tell them no.
      requireVerifiedToPublish(user, body.visibility);
      return db.transaction(async (tx) => {
        // Serialize hierarchy writes per owner so concurrent moves cannot
        // each pass validation against an outdated tree.
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
        const nodes = await tx.select().from(collections).where(eq(collections.userId, userId));
        const error = collectionParentError(nodes, body.parentId ?? null);
        if (error) throw new ConflictError(error);
        if (body.slug !== undefined && nodes.some((node) => node.slug === body.slug))
          throw new ConflictError("Slug already in use");
        const { slug, publishedAt } = await resolveVisibility(tx, {
          userId,
          requested: body.visibility,
          slug: body.slug,
          name: body.name,
        });
        const [collection] = await tx
          .insert(collections)
          .values({
            ...body,
            slug: slug ?? null,
            publishedAt,
            userId,
          })
          .returning();
        return collection;
      });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        slug: t.Optional(t.String({ minLength: 1, maxLength: 100, pattern: SLUG_PATTERN })),
        description: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        color: t.Optional(t.String({ pattern: COLOR_PATTERN })),
        parentId: t.Optional(t.String({ minLength: 1 })),
        // Publishing at create time is allowed, but still goes through
        // `resolveVisibility` below, so the username/slug preconditions and
        // `publishedAt` bookkeeping are identical to the update path.
        visibility: t.Optional(
          t.Union([t.Literal("private"), t.Literal("unlisted"), t.Literal("public")]),
        ),
      }),
    },
  )
  .get("/", async ({ user }) => {
    const userId = user.id;
    return db
      .select({
        id: collections.id,
        userId: collections.userId,
        name: collections.name,
        description: collections.description,
        icon: collections.icon,
        color: collections.color,
        parentId: collections.parentId,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        bookmarkCount: collectionBookmarkCount(collections.id).as(
          "bookmark_count",
        ),
        isSystem: collections.isSystem,
        slug: collections.slug,
        visibility: collections.visibility,
        publishedAt: collections.publishedAt,
      })
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(asc(collections.createdAt));
  })
  .get("/:id", async ({ params: { id }, user }) => {
    const userId = user.id;
    const [col] = await db
      .select({
        id: collections.id,
        userId: collections.userId,
        name: collections.name,
        description: collections.description,
        icon: collections.icon,
        color: collections.color,
        parentId: collections.parentId,
        isSystem: collections.isSystem,
        slug: collections.slug,
        visibility: collections.visibility,
        publishedAt: collections.publishedAt,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        bookmarkCount: collectionBookmarkCount(collections.id).as(
          "bookmark_count",
        ),
      })
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);
    if (!col) throw new NotFoundError();
    return col;
  })
  .patch(
    "/:id",
    async ({ params: { id }, user, body }) => {
      const userId = user.id;
      const provided = Object.values(body).filter((value) => value !== undefined);
      requireVerifiedToPublish(user, body.visibility);
      return db.transaction(async (tx) => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
        const nodes = await tx.select().from(collections).where(eq(collections.userId, userId));
        const existing = nodes.find((node) => node.id === id);
        if (!existing) throw new NotFoundError();
        // System collections are managed by the app — no field is user-editable.
        if (existing.isSystem && provided.length > 0)
          throw new ConflictError("cannot update system collection");
        if (body.slug !== undefined && nodes.some((node) => node.id !== id && node.slug === body.slug))
          throw new ConflictError("Slug already in use");
        if (body.parentId !== undefined) {
          const error = collectionParentError(nodes, body.parentId, id);
          if (error) throw new ConflictError(error);
        }
        const changes: typeof body & { publishedAt?: Date | null } = { ...body };
        if (body.visibility !== undefined) {
          const { slug, publishedAt } = await resolveVisibility(tx, {
            userId,
            requested: body.visibility,
            slug: body.slug,
            currentSlug: existing.slug,
            name: existing.name,
          });
          changes.slug = slug;
          changes.publishedAt = publishedAt;
        } else if (body.slug !== undefined) {
          // A slug change on an already-public collection must not strip
          // `publishedAt`, or the collection silently leaves Explore.
          const owner = await requireUsername(tx, userId);
          if (!owner) throw new ConflictError(NO_USERNAME_MESSAGE);
        }
        const [col] = await tx.update(collections).set(changes)
          .where(and(eq(collections.id, id), eq(collections.userId, userId))).returning();
        return col;
      });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        slug: t.Optional(t.String({ minLength: 1, maxLength: 100, pattern: SLUG_PATTERN })),
        description: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        color: t.Optional(t.String({ pattern: COLOR_PATTERN })),
        parentId: t.Optional(t.Union([t.String({ minLength: 1 }), t.Null()])),
        visibility: t.Optional(
          t.Union([t.Literal("private"), t.Literal("unlisted"), t.Literal("public")]),
        ),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params: { id }, user, query }) => {
      const userId = user.id;
      // Explicit opt-in to destroy the bookmarks as well. Accepts boolean
      // true or the string "true" (query-string form).
      const deleteBookmarks =
        query?.deleteBookmarks === true || query?.deleteBookmarks === "true";
      return db.transaction(async (tx) => {
        // Serialize hierarchy writes per owner so a concurrent move cannot
        // slip a child under a collection mid-delete.
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
        // Check before deleting — deleting first would remove a system
        // collection before the ConflictError below could stop it.
        const [col] = await tx
          .select({ id: collections.id, isSystem: collections.isSystem })
          .from(collections)
          .where(and(eq(collections.id, id), eq(collections.userId, userId)))
          .limit(1);
        if (!col) throw new NotFoundError();
        if (col.isSystem)
          throw new ConflictError("cannot delete system collection");

        // Deleting a parent must not silently dump children to top level
        // (parentId FK is onDelete: set null) — block and let the client
        // move or delete the subtree first.
        const children = await tx
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.userId, userId),
              eq(collections.parentId, col.id),
            ),
          );
        if (children.length > 0)
          throw new ConflictError(
            "Collection has sub-collections. Move or delete them first.",
            {
              childCount: children.length,
              childIds: children.map((c) => c.id),
            },
          );

        if (deleteBookmarks) {
          const inCollection = await tx
            .select({ bookmarkId: collectionItems.bookmarkId })
            .from(collectionItems)
            .where(eq(collectionItems.collectionId, col.id));
          const ids = inCollection.map((row) => row.bookmarkId);
          let deletedCount = 0;
          if (ids.length > 0) {
            const deleted = await tx
              .delete(bookmarks)
              .where(
                and(eq(bookmarks.userId, userId), inArray(bookmarks.id, ids)),
              )
              .returning({ id: bookmarks.id });
            deletedCount = deleted.length;
          }
          await tx.delete(collections).where(eq(collections.id, col.id));
          return { success: true, movedBookmarks: 0, deletedBookmarks: deletedCount };
        }

        // Default: keep the bookmarks. A bookmark that would be left with no
        // collection at all is re-homed to Unsorted, so a plain collection
        // delete never produces an unfiled bookmark.
        const unsortedId = await getSystemCollectionId(tx, userId, "unsorted");
        if (!unsortedId)
          throw new NotFoundError("unsorted collection not found");
        const inCollection = await tx
          .select({ bookmarkId: collectionItems.bookmarkId })
          .from(collectionItems)
          .where(eq(collectionItems.collectionId, col.id));
        const affectedIds = inCollection.map((row) => row.bookmarkId);
        await tx
          .delete(collectionItems)
          .where(eq(collectionItems.collectionId, col.id));
        let movedCount = 0;
        if (affectedIds.length > 0) {
          const stillFiled = await tx
            .select({ bookmarkId: collectionItems.bookmarkId })
            .from(collectionItems)
            .where(inArray(collectionItems.bookmarkId, affectedIds));
          const filed = new Set(stillFiled.map((row) => row.bookmarkId));
          const orphans = affectedIds.filter((id) => !filed.has(id));
          if (orphans.length > 0) {
            await tx
              .insert(collectionItems)
              .values(
                orphans.map((bookmarkId) => ({
                  collectionId: unsortedId,
                  bookmarkId,
                  position: 0,
                })),
              )
              .onConflictDoNothing();
            movedCount = orphans.length;
          }
        }
        await tx.delete(collections).where(eq(collections.id, col.id));
        // Shared links cascade off the collection FK — no code needed.
        return { success: true, movedBookmarks: movedCount, deletedBookmarks: 0 };
      });
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        deleteBookmarks: t.Optional(t.Union([t.Boolean(), t.String()])),
      }),
    },
  )
  .get(
    "/:id/bookmarks",
    async ({ params: { id }, user, query }) => {
      const userId = user.id;
      // 404 for foreign or nonexistent collections before listing anything.
      await requireUserCollection(db, userId, id);
      const { page, limit, offset } = normalizePagination({
        page: query.page,
        limit: query.limit,
      });

      const conditions = [
        eq(bookmarks.userId, userId),
        isInCollection(bookmarks.id, id),
      ];

      const [data, [{ count }]] = await Promise.all([
        db
          .select()
          .from(bookmarks)
          .where(and(...conditions))
          .orderBy(desc(bookmarks.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(bookmarks)
          .where(and(...conditions)),
      ]);

      return {
        data,
        pagination: createPaginationMeta(page, limit, Number(count)),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1 })),
      }),
    },
  )
  .post("/:id/fork", async ({ params: { id }, user }) => {
    const userId = user.id;

    // Access: the source must be readable by the caller. Own collections are
    // always forkable (it is a copy, not a move). Public/unlisted ones are
    // forkable by anyone — that is the social loop.
    const [source] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);
    if (!source) throw new NotFoundError("Collection not found.");
    if (source.userId !== userId && source.visibility === "private") {
      throw new NotFoundError("Collection not found.");
    }

    // Fetch the whole subtree (root + descendants) in one recursive CTE.
    const subtree = await db.execute(sql`
      WITH RECURSIVE tree AS (
        SELECT id, user_id, name, description, icon, color, parent_id,
               is_system, slug, visibility, published_at, created_at, updated_at
        FROM collections WHERE id = ${id}
        UNION ALL
        SELECT c.id, c.user_id, c.name, c.description, c.icon, c.color,
               c.parent_id, c.is_system, c.slug, c.visibility, c.published_at,
               c.created_at, c.updated_at
        FROM collections c
        JOIN tree t ON c.parent_id = t.id
      )
      SELECT * FROM tree
    `);

    const nodes = (subtree.rows ?? []) as Array<{
      id: string;
      user_id: string;
      name: string;
      description: string | null;
      icon: string | null;
      color: string | null;
      parent_id: string | null;
      is_system: boolean;
      slug: string | null;
      visibility: string;
      published_at: Date | null;
    }>;

    if (nodes.length === 0) throw new NotFoundError("Collection not found.");

    // Map old collection id → new collection id. Parents are created first.
    const idMap = new Map<string, string>();

    // Topological order: parents before children.
    const sorted: typeof nodes = [];
    const visited = new Set<string>();
    function walk(nodeId: string) {
      if (visited.has(nodeId)) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (node.parent_id && nodes.some((n) => n.id === node.parent_id)) {
        walk(node.parent_id);
      }
      visited.add(nodeId);
      sorted.push(node);
    }
    for (const n of nodes) walk(n.id);

    // Create new collections in topological order.
    let rootId: string | null = null;
    for (const node of sorted) {
      const newParentId = node.id === id ? null : idMap.get(node.parent_id!) ?? null;
      const [created] = await db
        .insert(collections)
        .values({
          userId,
          name: node.id === id ? `${node.name} (fork)` : node.name,
          description: node.description,
          icon: node.icon,
          color: node.color,
          parentId: newParentId,
          isSystem: false,
          slug: null,
          visibility: "private",
          publishedAt: null,
        })
        .returning();
      idMap.set(node.id, created.id);
      if (node.id === id) rootId = created.id;
    }

    // Copy bookmarks and collection_items for each collection.
    for (const node of sorted) {
      const newCollectionId = idMap.get(node.id)!;

      // Fetch the source collection's items with positions and notes.
      const items = await db
        .select({
          bookmarkId: collectionItems.bookmarkId,
          position: collectionItems.position,
          note: collectionItems.note,
        })
        .from(collectionItems)
        .where(eq(collectionItems.collectionId, node.id))
        .orderBy(asc(collectionItems.position));

      for (const item of items) {
        // Fetch the source bookmark.
        const [srcBookmark] = await db
          .select()
          .from(bookmarks)
          .where(eq(bookmarks.id, item.bookmarkId))
          .limit(1);
        if (!srcBookmark) continue;

        // Dedup by URL within the caller's account: reuse if already saved.
        let newBookmarkId: string;
        const [existing] = await db
          .select({ id: bookmarks.id })
          .from(bookmarks)
          .where(and(eq(bookmarks.userId, userId), eq(bookmarks.url, srcBookmark.url)))
          .limit(1);

        if (existing) {
          newBookmarkId = existing.id;
        } else {
          // Create a copy of the bookmark, linking to the same shared link.
          const [created] = await db
            .insert(bookmarks)
            .values({
              userId,
              url: srcBookmark.url,
              title: srcBookmark.title,
              description: srcBookmark.description,
              note: srcBookmark.note,
              cover: srcBookmark.cover,
              domain: srcBookmark.domain,
              isFavorite: false,
              archivedAt: srcBookmark.archivedAt,
              linkId: srcBookmark.linkId,
            })
            .returning();
          newBookmarkId = created.id;
        }

        // Create the collection_item, skipping if it already exists (idempotent).
        await db
          .insert(collectionItems)
          .values({
            collectionId: newCollectionId,
            bookmarkId: newBookmarkId,
            position: item.position,
            note: item.note,
          })
          .onConflictDoNothing();
      }
    }

    if (!rootId) throw new Error("Fork failed: no root collection created.");

    const [root] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, rootId))
      .limit(1);

    return root;
  }, {
    params: t.Object({ id: t.String({ minLength: 1 }) }),
  })
  .get("/:id/children", async ({ params: { id }, user }) => {
    const userId = user.id;
    return db
      .select({
        id: collections.id,
        userId: collections.userId,
        name: collections.name,
        description: collections.description,
        icon: collections.icon,
        color: collections.color,
        parentId: collections.parentId,
        isSystem: collections.isSystem,
        slug: collections.slug,
        visibility: collections.visibility,
        publishedAt: collections.publishedAt,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        bookmarkCount: collectionBookmarkCount(collections.id).as(
          "bookmark_count",
        ),
      })
      .from(collections)
      .where(and(eq(collections.userId, userId), eq(collections.parentId, id)))
      .orderBy(asc(collections.createdAt));
  })
  .get("/by-slug/:slug", async ({ params: { slug }, user }) => {
    const userId = user.id;
    const [col] = await db
      .select({
        id: collections.id,
        userId: collections.userId,
        name: collections.name,
        description: collections.description,
        icon: collections.icon,
        color: collections.color,
        parentId: collections.parentId,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        isSystem: collections.isSystem,
        slug: collections.slug,
        bookmarkCount: collectionBookmarkCount(collections.id).as(
          "bookmark_count",
        ),
      })
      .from(collections)
      .where(and(eq(collections.userId, userId), eq(collections.slug, slug)))
      .limit(1);
    if (!col) throw new NotFoundError();
    return col;
  })
  // === SHARE MANAGEMENT ===
  .post(
    "/:id/share",
    async ({ params: { id }, user }) => {
      const userId = user.id;

      // A share code is a publication whatever the collection's visibility says:
      // `/share/:code` serves it to anyone holding the address. Gated here as
      // well as on the visibility write, because this route also re-activates a
      // previously deactivated share.
      requireVerifiedPublisher(user);

      // verify collection exists and belongs to user
      const [col] = await db
        .select({
          id: collections.id,
          isSystem: collections.isSystem,
        })
        .from(collections)
        .where(and(eq(collections.id, id), eq(collections.userId, userId)))
        .limit(1);

      if (!col) throw new NotFoundError();
      if (col.isSystem) throw new ForbiddenError("cannot share system collections");

      // check if already shared — return existing
      const [existing] = await db
        .select()
        .from(sharedCollections)
        .where(
          and(
            eq(sharedCollections.collectionId, id),
            eq(sharedCollections.userId, userId),
          ),
        )
        .limit(1);

      if (existing) {
        // re-activate if it was deactivated
        if (!existing.isActive) {
          await db
            .update(sharedCollections)
            .set({ isActive: true })
            .where(eq(sharedCollections.id, existing.id));
        }
        return {
          id: existing.id,
          shareCode: existing.shareCode,
          isActive: true,
          createdAt: existing.createdAt,
        };
      }

      // create new share
      const shareCode = generateShareCode();
      const [share] = await db
        .insert(sharedCollections)
        .values({
          userId,
          collectionId: id,
          shareCode,
        })
        .returning();

      return {
        id: share.id,
        shareCode: share.shareCode,
        isActive: share.isActive,
        createdAt: share.createdAt,
      };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get(
    "/:id/share",
    async ({ params: { id }, user }) => {
      const userId = user.id;

      const [share] = await db
        .select()
        .from(sharedCollections)
        .where(
          and(
            eq(sharedCollections.collectionId, id),
            eq(sharedCollections.userId, userId),
          ),
        )
        .limit(1);

      if (!share || !share.isActive) return null;

      return {
        id: share.id,
        shareCode: share.shareCode,
        isActive: share.isActive,
        createdAt: share.createdAt,
      };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/:id/share",
    async ({ params: { id }, user }) => {
      const userId = user.id;

      const [share] = await db
        .update(sharedCollections)
        .set({ isActive: false })
        .where(
          and(
            eq(sharedCollections.collectionId, id),
            eq(sharedCollections.userId, userId),
          ),
        )
        .returning();

      if (!share) throw new NotFoundError("no share found for this collection");

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
