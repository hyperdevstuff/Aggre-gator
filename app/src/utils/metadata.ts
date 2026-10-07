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
const MAX_HTML_BYTES = 512 * 1024;
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
    return fallback(targetUrl);
  }
}