import { Elysia, t } from "elysia";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { bookmarks, collections, tags } from "../db/schema";
import { betterAuthPlugin } from "../utils/auth";
import { ftsCondition } from "../utils/full-text-search";

export const searchRouter = new Elysia({ prefix: "/search" })
    .use(betterAuthPlugin)
    .get(
        "/",
        async ({ query: { q }, user }) => {
            const userId = user.id;

            // Full-text over generated `search_vector` columns (bookmarks:
            // title + description + domain; collections: name + description)
            // and an expression index on tag names. Word matches plus a
            // prefix arm, so "zepp" finds "Zeppelin" — but mid-word
            // substrings the old ILIKE matched no longer do.
            const [bookmarksResults, collectionsResults, tagsResults] =
                await Promise.all([
                    db.select({
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
                                ftsCondition(sql`bookmarks.search_vector`, q),
                            ),
                        )
                        .limit(10),
                    db.select({
                        id: collections.id,
                        name: collections.name,
                        type: sql<string>`'collections'`.as("type"),
                    })
                        .from(collections)
                        .where(
                            and(
                                eq(collections.userId, userId),
                                ftsCondition(sql`collections.search_vector`, q),
                            ),
                        )
                        .limit(5),
                    db.select({
                        id: tags.id,
                        name: tags.name,
                        type: sql<string>`'tags'`.as("type"),
                    })
                        .from(tags)
                        .where(
                            and(
                                eq(tags.userId, userId),
                                ftsCondition(sql`to_tsvector('english', ${tags.name})`, q),
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
