/**
 * The `enrich-metadata` job handler.
 *
 * Lives apart from `utils/jobs.ts` so the queue stays generic and this — which
 * knows about bookmarks — can be tested on its own.
 *
 * Retry and backoff are the queue's job (see `utils/jobs.ts`); what happens here
 * is deciding *whether* a failure is worth retrying, and which fields we are
 * allowed to write.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { bookmarks } from "../db/schema";
import type { JobPayloads } from "./jobs";
import scrapeMetadata from "./metadata";

export async function enrichMetadata(
  payload: JobPayloads["enrich-metadata"],
) {
  const { bookmarkId, url, placeholderTitle, keep, fillTitle } = payload;

  const meta = await scrapeMetadata(url);

  // Retry only what could plausibly succeed on a second attempt. A refused
  // SSRF URL and a 404 will never resolve, and burning four more fetches on
  // them costs a third-party nothing but us rate-limit goodwill — so those keep
  // the hostname fallback and finish. A timeout or a 5xx is exactly what the
  // queue's backoff exists for.
  //
  // Note this needs the `ok` flag rather than "is the title still a hostname":
  // a page can legitimately *be* titled `example.com`, and a transient failure
  // must not be mistaken for a successful parse of one.
  if (!meta.ok && meta.retryable) {
    throw new Error(`scrape failed for ${url}: ${meta.reason ?? "unknown"}`);
  }

  await db
    .update(bookmarks)
    .set({
      // `fillTitle` is false when the user supplied their own title at save
      // time. Previously the whole enrichment was skipped in that case, so a
      // hand-titled bookmark could never get a cover — the two decisions are
      // independent and are now made separately.
      ...(fillTitle ? { title: meta.title } : {}),
      description: keep.description ?? meta.description,
      cover: keep.cover ?? meta.image,
    })
    // Only overwrite while the row still holds the placeholder, so a user edit
    // made while this job waited in the queue survives it. When the user gave us
    // a title, `placeholderTitle` is that title, so the guard still protects a
    // later edit — and the title is not written at all.
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.title, placeholderTitle)));
}