import { Elysia, t } from "elysia";
import { db } from "../db";
import { bookmarks, collections, tags } from "../db/schema";
import { auth } from "../utils/auth";
import { UnauthorizedError } from "../error";
import { and, eq, sql } from "drizzle-orm";

export const searchRouter = new Elysia({ prefix: "/search" }).get(
  "/",
  async ({ query: { q }, request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) throw new UnauthorizedError();

    const userId = session.user.id;
    const searchPattern = `%${q}%`;

    const [bookmarksResults, collectionsResults, tagsResults] =
      await Promise.all([
        db
          .select({
            id: bookmarks.id,
            title: bookmarks.title,
            url: bookmarks.url,
            domain: bookmarks.domain,
            type: sql<string>`'bookmarks'`.as("type"),
          })
          .from(bookmarks)
          .where(
            and(
              eq(bookmarks.userId, userId),
              sql`(${bookmarks.title} ILIKE ${searchPattern}
                             OR ${bookmarks.url} ILIKE ${searchPattern}
                             OR ${bookmarks.description} ILIKE ${searchPattern})`,
            ),
          )
          .limit(10),
        db
          .select({
            id: collections.id,
            name: collections.name,
            type: sql<string>`'collections'`.as("type"),
          })
          .from(collections)
          .where(
            and(
              eq(collections.userId, userId),
              sql`(${collections.name} ILIKE ${searchPattern}
                             OR ${collections.description} ILIKE ${searchPattern})`,
            ),
          )
          .limit(5),
        db
          .select({
            id: tags.id,
            name: tags.name,
            type: sql<string>`'tags'`.as("type"),
          })
          .from(tags)
          .where(
            and(
              eq(tags.userId, userId),
              sql`(${tags.name} ILIKE ${searchPattern})`,
            ),
          )
          .limit(5),
      ]);
    return {
      bookmarks: bookmarksResults,
      collections: collectionsResults,
      tags: tagsResults,
    };
  },
  {
    query: t.Object({
      q: t.String({ minLength: 1, maxLength: 100 }),
    }),
  },
);
