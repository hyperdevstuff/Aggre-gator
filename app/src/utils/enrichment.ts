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
import { bookmarks, links } from "../db/schema";
import type { JobPayloads } from "./jobs";
import scrapeMetadata from "./metadata";

export async function enrichMetadata(
  payload: JobPayloads["enrich-metadata"],
) {
  const { bookmarkId, linkId, url, placeholderTitle, keep, fillTitle } = payload;

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

  // The bookmark's own preview. `fillTitle` is false when the user supplied
  // their own title at save time, so the scraped title never clobbers it; the
  // description and cover are still filled. The placeholder guard protects a
  // later edit that landed while the job was queued.
  await db
    .update(bookmarks)
    .set({
      ...(fillTitle ? { title: meta.title } : {}),
      description: keep.description ?? meta.description,
      cover: keep.cover ?? meta.image,
    })
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.title, placeholderTitle)));

  // The shared preview on the `links` row. Unlike the bookmark, the link has no
  // "user-supplied title" concept — it is the canonical preview for the URL, so
  // the scraped title always wins here. Only the first save enqueues a job, so
  // this runs once per unique URL.
  if (linkId) {
    await db
      .update(links)
      .set({
        title: meta.title,
        description: meta.description,
        cover: meta.image,
        updatedAt: new Date(),
      })
      .where(eq(links.id, linkId));
  }
}