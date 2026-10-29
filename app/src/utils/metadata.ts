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

const FETCH_TIMEOUT_MS = 5000;
/**
 * Hard ceiling on buffered bytes.
 *
 * This is a DoS guard, not a tuning knob — a hostile or enormous page must not
 * be held in memory. It is deliberately still modest: the queue runs a small
 * batch (`BATCH_SIZE` in `utils/jobs.ts`) and `POST /bookmarks` is rate
 * limited, so the worst case is a few MB transient, not unbounded.
 *
 * It was raised from 512KB while fixing the missing-cover bug, because two
 * distinct shapes were losing `og:image` and only one of them is fixable by
 * extraction alone:
 *
 *   - junk *after* `</head>` → fixed by `headFirstHtml`, no cap change needed
 *   - megabytes of inline `<script>` *inside* `<head>` → the metadata is
 *     genuinely past the cut, so the only remedy is reading further
 *
 * Real pages inline far more JavaScript into `<head>` than a 512KB budget
 * assumed, which is why the second shape was common enough to measure.
 */
const MAX_HTML_BYTES = 2 * 1024 * 1024;
/**
 * How much of the buffer we are willing to search for `<head>`.
 *
 * `<head>` is almost always within the first few KB; some pages front-load
 * megabytes of inline CSS/JS before the metadata, and those are exactly the
 * pages that were losing their covers.
 */
const HEAD_SEARCH_BYTES = 256 * 1024;
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
 * Whether a thrown fetch error is a permanent answer from the server.
 *
 * `fetchHtml` throws `http <status>` for a non-2xx response, so 404 and 410 are
 * the server saying this resource is gone. 429 is deliberately *not* permanent —
 * it is the clearest possible case of "come back later".
 */
function isPermanentStatus(error: unknown) {
  if (!(error instanceof Error)) return false;
  const match = /^http (\d{3})$/.exec(error.message);
  if (!match) return false;
  const status = Number(match[1]);
  return status >= 400 && status < 500 && status !== 429;
}

/**
 * Reduce a page to what metadata extraction actually needs.
 *
 * **Why this exists.** The 512KB cap used to truncate pages mid-document, and
 * because `<title>` sits early in `<head>` while `og:image` frequently sits much
 * later, the cut landed *between* them: the save got a real title and no cover.
 * That is the "returned a title with no image" symptom measured on the live
 * deploy, and it is a cap problem rather than a metascraper one — verified
 * against single quotes, unquoted attributes, uppercase `OG:`, protocol-relative
 * URLs, JSON-LD, `og:image` inside `<body>` and odd title whitespace, all of
 * which metascraper handled correctly.
 *
 * Raising the cap alone would not have been enough either — see the note on
 * `MAX_HTML_BYTES` for the two distinct shapes this fixes. Both are needed:
 *
 *  - If `<head>` is found within the first `HEAD_SEARCH_BYTES`, keep only the
 *    head. Extraction only ever reads meta tags, JSON-LD and the title, all of
 *    which live there — so nothing is lost, and a multi-megabyte `<body>` can no
 *    longer cost us the cover.
 *  - Otherwise pass the whole buffer through unchanged, so pages that put
 *    metadata in `<body>` (or ship no `<head>` at all) still work exactly as
 *    before.
 *
 * A full page that legitimately has no `<head>` close to the start is rare, and
 * it degrades to today's behaviour rather than to a failure.
 */
export function headFirstHtml(html: string): string {
  // Only the prefix is searched: a `<head>` string appearing deep in the body
  // is not the document head, and slicing to it would discard the real one.
  const headOpen = html.slice(0, HEAD_SEARCH_BYTES).search(/<head[\s>]/i);
  if (headOpen === -1) return html;

  const headEnd = html.slice(headOpen).search(/<\/head\s*>/i);
  if (headEnd === -1) return html;

  return html.slice(headOpen, headOpen + headEnd);
}

/**
 * Fetch `targetUrl` following redirects by hand so every hop is re-validated
 * by `assertSafeToFetch` (a public URL can redirect into the private network).
 */
async function fetchHtml(targetUrl: string): Promise<{ html: string; finalUrl: URL }> {
  let current = targetUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertSafeToFetch(current);
    const response = await fetch(url, {
      // Manual: `redirect: "follow"` would hide the next hop from the guard.
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`redirect ${response.status} without a location header`);
      current = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) throw new Error(`http ${response.status}`);
    return { html: await readCappedText(response, MAX_HTML_BYTES), finalUrl: url };
  }
  throw new Error(`too many redirects (>${MAX_REDIRECTS})`);
}

export type ScrapeResult = ScrapedMetadata & {
  /**
   * Whether the page was actually fetched and parsed.
   *
   * `false` means we fell back to the hostname. This distinction matters because
   * the enrichment job retries on failure: a timeout or a 503 is worth another
   * attempt, while a refused-by-SSRF URL or a 404 never will be. Without this
   * flag a transient blip looks like success and the retry machinery built in
   * `be-01` would never fire.
   */
  ok: boolean;
  /**
   * Whether another attempt could plausibly succeed. `false` for a refusal by
   * the SSRF guard and for a 4xx — permanent by nature, so retrying only burns
   * requests. `undefined` when `ok` is true.
   */
  retryable?: boolean;
  /** The failure reason, for the job's `last_error`. */
  reason?: string;
};

export default async function scrapeMetadata(targetUrl: string): Promise<ScrapeResult> {
  let hostname: string;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    return {
      title: targetUrl,
      description: null,
      image: null,
      domain: "",
      url: targetUrl,
      ok: false,
    };
  }

  try {
    const { html, finalUrl } = await fetchHtml(targetUrl);
    const metadata = await scraper({
      html: headFirstHtml(html),
      url: finalUrl.toString(),
    });
    return {
      title: clamp(metadata.title || hostname, MAX_TITLE_LENGTH),
      description: metadata.description
        ? clamp(metadata.description, MAX_DESCRIPTION_LENGTH)
        : null,
      image: safeImageUrl(metadata.image),
      domain: finalUrl.hostname,
      url: finalUrl.toString(),
      ok: true,
    };
  } catch (e) {
    // Expected for unreachable/dead URLs, and for URLs the guard refuses —
    // the hostname fallback is the designed behavior, so keep the log to one
    // line instead of a full stack.
    const reason =
      e instanceof UnsafeUrlError
        ? "refused by ssrf guard"
        : e instanceof Error
          ? e.message
          : e;
    console.warn(`scrapeMetadata: failed to fetch ${targetUrl}: ${reason}`);
    return {
      ...fallback(targetUrl),
      ok: false,
      // A refused URL can never become safe, and a 4xx is the server telling us
      // this will not change. Both are permanent; timeouts and 5xx are not.
      retryable: !(e instanceof UnsafeUrlError) && !isPermanentStatus(e),
      reason: String(reason),
    };
  }
}