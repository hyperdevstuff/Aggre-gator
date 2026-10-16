/**
 * The `enrich-metadata` job handler.
 *
 * Lives apart from `utils/jobs.ts` so the queue stays generic and this — which
 * knows about bookmarks — can be tested on its own.
 *
 * Retry and backoff are the queue's job (see `utils/jobs.ts`); what happens
 * here is deliberately small: fetch best-effort metadata, write it only while
 * the row still holds the placeholder title.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { bookmarks } from "../db/schema";
import type { JobPayloads } from "./jobs";
import scrapeMetadata from "./metadata";

export async function enrichMetadata(
  payload: JobPayloads["enrich-metadata"],
) {
  const { bookmarkId, url, placeholderTitle, keep } = payload;

  // A 404 or a dead host is a legitimate outcome, not a crash: `scrapeMetadata`
  // already falls back to the hostname and logs one line. Throwing here would
  // burn every retry on a URL that will never resolve.
  const meta = await scrapeMetadata(url);

  await db
    .update(bookmarks)
    .set({
      title: meta.title,
      description: keep.description ?? meta.description,
      cover: keep.cover ?? meta.image,
    })
    // Only overwrite while the row still holds the placeholder, so a user edit
    // made while this job waited in the queue survives it.
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.title, placeholderTitle)));
}