import metascraper from "metascraper";
import metascraperDescription from "metascraper-description";
import metascraperImage from "metascraper-image";
import metascraperTitle from "metascraper-title";
import metascraperUrl from "metascraper-url";
import { assertSafeToFetch, UnsafeUrlError } from "./url-guard";

const scraper = metascraper([
  metascraperDescription(),
  metascraperImage(),
  metascraperTitle(),
  metascraperUrl(),
]);

/**
 * A scrape that failed for a reason which may not recur: a timeout, a dropped
 * connection, a 429 or a 5xx.
 *
 * These are deliberately *not* folded into the hostname fallback. The queue
 * retries them with backoff (see `utils/jobs.ts`), which is the whole point of
 * having moved enrichment onto it. A 404, a refused URL or a redirect loop is
 * permanent and still falls back — retrying those would burn five attempts on a
 * page that will never resolve.
 */
export class TransientScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientScrapeError";
  }
}

const FETCH_TIMEOUT_MS = 5000;
/**
 * Two separate budgets, because they defend against different things.
 *
 * `MAX_HTML_BYTES` is what we hand to the parser, kept small so a hostile page
 * cannot be buffered into memory. `MAX_READ_BYTES` is how much we are willing to
 * pull off the wire while looking for the metadata, and is larger on purpose: a
 * modern page can front-load megabytes of inline `<script>` before its
 * `<meta og:image>`, and reading a couple of MB that we then throw away is cheap
 * next to losing the cover. See `stripSkippedElements`.
 */
const MAX_HTML_BYTES = 512 * 1024;
const MAX_READ_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
/** Matches the `bookmarks` API validation so a scraped value can never be rejected later. */
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 2000;

export type ScrapedMetadata = {
  title: string;
  description: string | null;
  image: string | null;
  domain: string;
  url: string;
};

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Covers are rendered as `<img src>` in the client, so keep only absolute
 * http(s) URLs. Everything else (`javascript:`, `data:`, relative) is dropped.
 */
function safeImageUrl(candidate: string | undefined | null): string | null {
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function fallback(targetUrl: string): ScrapedMetadata {
  const { hostname } = new URL(targetUrl);
  return {
    title: hostname,
    description: null,
    image: null,
    domain: hostname,
    url: targetUrl,
  };
}

/**
 * Read the body but stop at `maxBytes` — a hostile or simply enormous page
 * must not be buffered into memory.
 */
async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        break;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock?.();
  }
  return text + decoder.decode();
}

/**
 * Drop whole `<script>` and `<style>` elements before the size cap is applied.
 *
 * Metadata lives in `<title>`/`<meta>`, which these elements never contain, and
 * on a modern page they are the overwhelming majority of the bytes. Removing
 * them first is what stops the cap from cutting between `<title>` and
 * `<meta og:image>` on a page with a large inline bundle — the measured cause of
 * saves that kept their title and silently lost their cover.
 *
 * An element whose closing tag never arrived (cut off by the read budget) is
 * left alone: the pattern needs both tags, so a truncated script is kept
 * verbatim rather than swallowing the rest of the document.
 */
const SKIPPED_ELEMENTS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

function stripSkippedElements(html: string): string {
  return html.replace(SKIPPED_ELEMENTS, "");
}

/**
 * Read enough of the response for the parser to work with, without holding the
 * whole document: pull up to the read budget, discard the elements that cannot
 * carry metadata, then keep the first `MAX_HTML_BYTES` of what is left.
 */
async function readHtml(response: Response): Promise<string> {
  const raw = await readCappedText(response, MAX_READ_BYTES);
  return stripSkippedElements(raw).slice(0, MAX_HTML_BYTES);
}

/**
 * Fetch `targetUrl` following redirects by hand so every hop is re-validated
 * by `assertSafeToFetch` (a public URL can redirect into the private network).
 */
async function fetchHtml(targetUrl: string): Promise<{ html: string; finalUrl: URL }> {
  let current = targetUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertSafeToFetch(current);

    let response: Response;
    try {
      response = await fetch(url, {
        // Manual: `redirect: "follow"` would hide the next hop from the guard.
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BookmarkBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      // Timeouts and dropped connections are the URL's problem on this attempt,
      // not a verdict on it: let the queue retry with backoff.
      throw new TransientScrapeError(
        `fetch failed: ${e instanceof Error ? e.message : e}`,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`redirect ${response.status} without a location header`);
      current = new URL(location, url).toString();
      continue;
    }

    // 429 and 5xx are the server asking us to come back later; retry those too.
    if (response.status === 429 || response.status >= 500) {
      throw new TransientScrapeError(`http ${response.status}`);
    }

    if (!response.ok) throw new Error(`http ${response.status}`);
    return { html: await readHtml(response), finalUrl: url };
  }
  throw new Error(`too many redirects (>${MAX_REDIRECTS})`);
}

export default async function scrapeMetadata(targetUrl: string): Promise<ScrapedMetadata> {
  let hostname: string;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    return { title: targetUrl, description: null, image: null, domain: "", url: targetUrl };
  }

  try {
    const { html, finalUrl } = await fetchHtml(targetUrl);
    const metadata = await scraper({ html, url: finalUrl.toString() });
    return {
      title: clamp(metadata.title || hostname, MAX_TITLE_LENGTH),
      description: metadata.description
        ? clamp(metadata.description, MAX_DESCRIPTION_LENGTH)
        : null,
      image: safeImageUrl(metadata.image),
      domain: finalUrl.hostname,
      url: finalUrl.toString(),
    };
  } catch (e) {
    // A transient failure is thrown, not swallowed: the queue owns retries, and
    // treating "the server was briefly down" as "this page has no metadata"
    // silently cost the cover. Everything else — a 404, a refused URL, a
    // redirect loop — is a real fallback, so keep the log to one line instead of
    // a full stack.
    if (e instanceof TransientScrapeError) throw e;

    const reason =
      e instanceof UnsafeUrlError
        ? "refused by ssrf guard"
        : e instanceof Error
          ? e.message
          : e;
    console.warn(`scrapeMetadata: failed to fetch ${targetUrl}: ${reason}`);
    return fallback(targetUrl);
  }
}