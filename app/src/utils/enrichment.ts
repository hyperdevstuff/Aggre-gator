/**
 * The `enrich-metadata` job handler.
 *
 * Lives apart from `utils/jobs.ts` so the queue stays generic and this — which
 * knows about bookmarks — can be tested on its own.
 *
 * Retry and backoff are the queue's job (see `utils/jobs.ts`); what happens here
 * is deliberately small: fetch best-effort metadata, then write back only the
 * fields the user left empty, and only while those fields still hold the value
 * they had at save time.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { bookmarks } from "../db/schema";
import type { JobPayloads } from "./jobs";
import scrapeMetadata from "./metadata";

export async function enrichMetadata(
  payload: JobPayloads["enrich-metadata"],
) {
  const { bookmarkId, url, placeholderTitle, keep } = payload;

  // A transient failure (timeout, 5xx) is thrown on purpose so the queue retries
  // it. A permanent one (404, refused URL) has already fallen back to the
  // hostname inside `scrapeMetadata`, and this completes normally.
  const meta = await scrapeMetadata(url);

  // Fill in only what the caller did not. Writing every field and relying on a
  // single title guard would clobber a hand-titled bookmark's own description;
  // and an update with no columns is invalid SQL, so an empty patch is a no-op.
  const patch: {
    title?: string;
    description?: string | null;
    cover?: string | null;
  } = {};

  // Each guard is the value this job is allowed to overwrite. Anything else
  // means the user got there first, and their edit must survive the job.
  const guards = [eq(bookmarks.id, bookmarkId)];

  if (!keep.title) {
    patch.title = meta.title;
    guards.push(eq(bookmarks.title, placeholderTitle));
  }
  if (!keep.description) {
    patch.description = meta.description;
    guards.push(isNull(bookmarks.description));
  }
  if (!keep.cover) {
    patch.cover = meta.image;
    guards.push(isNull(bookmarks.cover));
  }

  if (Object.keys(patch).length === 0) return;

  await db.update(bookmarks).set(patch).where(and(...guards));
}
