import { Elysia, t } from "elysia";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { collections, user as users } from "../db/schema";
import { NotFoundError } from "../error";
import { rateLimitGuard } from "../utils/rate-limit";
import { collectionBookmarkCount } from "../utils/collections";
import { usernameEq } from "../utils/user-identity";
import { renderOgCard } from "./render";

/**
 * Open Graph card images.
 *
 * Served from the API, not nginx: the SPA catch-all would otherwise swallow
 * `/og/…` and answer with `index.html`, and every platform rejects a
 * `text/html` body where a PNG was declared. nginx proxies this prefix through
 * unconditionally (see `client/nginx.conf`) — unlike the public pages, it has no
 * browser/SPA variant, so there is nothing to disambiguate.
 *
 * Cached hard: platforms fetch these to unfurl a link and rarely re-fetch, so a
 * cache miss is expensive and a slightly stale card is cheap.
 */
const OG_CACHE = "public, max-age=86400, stale-while-revalidate=43200";

function png(bytes: Uint8Array): Response {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": OG_CACHE,
      "Content-Length": String(bytes.byteLength),
    },
  });
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Elysia's router has no syntax for "a param followed by a literal suffix", so
 * in `/collection/:id.png` it names the captured segment `id.png` and hands the
 * *whole* segment over — suffix included. The schema key has to match that name
 * exactly, and the suffix is stripped here.
 *
 * Registering both `/collection/:id` and `/collection/:id.png` is not an option:
 * memoirist rejects the pair as a duplicate location with conflicting parameter
 * names. One route that tolerates either form is simpler and works.
 */
const ID_PARAM = { name: "id.png", schema: t.String({ minLength: 1, maxLength: 128 }) };
const USERNAME_PARAM = {
  name: "username.png",
  schema: t.String({ minLength: 1, maxLength: 64 }),
};

function stripExtension(value: string): string {
  return value.replace(/\.png$/i, "");
}

export const ogRouter = new Elysia({ prefix: "/og" })
  /**
   * Card for a collection: `GET /og/collection/:id.png`.
   *
   * Any collection the caller could already reach renders, private ones
   * included — the id is a uuid, and the card carries only the name and a
   * count, so rendering is not a disclosure channel.
   */
  .get(
    "/collection/:id.png",
    async ({ params }) => {
      const id = stripExtension(params[ID_PARAM.name as "id.png"]);
      const [row] = await db
        .select({
          id: collections.id,
          name: collections.name,
          description: collections.description,
          owner: users.username,
          ownerName: users.name,
          bookmarkCount:
            collectionBookmarkCount(collections.id).as("bookmark_count"),
        })
        .from(collections)
        .innerJoin(users, eq(collections.userId, users.id))
        .where(eq(collections.id, id))
        .limit(1);

      if (!row) throw new NotFoundError("collection not found");

      const bytes = await renderOgCard({
        title: row.name,
        eyebrow: row.owner ? `@${row.owner}` : row.ownerName,
        subtitle: row.description ?? undefined,
        meta: plural(row.bookmarkCount ?? 0, "bookmark"),
      });
      return png(bytes);
    },
    {
      beforeHandle: rateLimitGuard({
        name: "og:collection",
        limit: 120,
        perUser: false,
      }),
      params: t.Object({ [ID_PARAM.name]: ID_PARAM.schema }),
    },
  )
  /** Card for a profile: `GET /og/profile/:username.png`. */
  .get(
    "/profile/:username.png",
    async ({ params }) => {
      const username = stripExtension(params[USERNAME_PARAM.name as "username.png"]);
      const [profile] = await db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          bio: users.bio,
        })
        .from(users)
        .where(usernameEq(username))
        .limit(1);
      if (!profile) throw new NotFoundError("profile not found");

      // Public collections only, matching what the profile page itself shows.
      const [stats] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(collections)
        .where(
          and(
            eq(collections.userId, profile.id),
            eq(collections.visibility, "public"),
            eq(collections.isSystem, false),
          ),
        );

      const count = Number(stats?.count ?? 0);
      const bytes = await renderOgCard({
        title: `@${profile.username}`,
        eyebrow: profile.name,
        subtitle: profile.bio ?? undefined,
        meta: plural(count, "published collection"),
      });
      return png(bytes);
    },
    {
      beforeHandle: rateLimitGuard({
        name: "og:profile",
        limit: 120,
        perUser: false,
      }),
      params: t.Object({ [USERNAME_PARAM.name]: USERNAME_PARAM.schema }),
    },
  );