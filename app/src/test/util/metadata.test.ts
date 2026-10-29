import { describe, test, expect, afterEach, beforeEach, spyOn, mock } from "bun:test";
import scrapeMetadata, { headFirstHtml } from "../../utils/metadata";
import { resetHostResolver, setHostResolver } from "../../utils/url-guard";

/** A public address so the guard allows the request without live DNS. */
const PUBLIC_IP = "93.184.216.34";

describe("metadata scraping", () => {
  afterEach(() => {
    // Bun keeps `spyOn` mocks alive for the whole file, so per-test call counts
    // only mean something with an explicit restore.
    mock.restore();
    resetHostResolver();
  });

  test("falls back to hostname on fetch failure", async () => {
    spyOn(global, "fetch").mockRejectedValue(new Error("timeout"));

    const meta = await scrapeMetadata("https://example.com/page");

    expect(meta.title).toBe("example.com");
    expect(meta.domain).toBe("example.com");
  });

  test("extracts metadata from valid html", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    spyOn(global, "fetch").mockResolvedValue(
      new Response(`
        <html>
          <head>
            <title>Test Page</title>
            <meta property="og:description" content="test desc">
            <meta property="og:image" content="https://example.com/img.jpg">
          </head>
        </html>
      `),
    );

    const meta = await scrapeMetadata("https://example.com");

    expect(meta.title).toBe("Test Page");
    expect(meta.description).toContain("test desc");
    expect(meta.image).toBe("https://example.com/img.jpg");
  });

  test("drops a non-http cover image instead of handing it to the client", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    spyOn(global, "fetch").mockResolvedValue(
      new Response(
        `<html><head><title>T</title><meta property="og:image" content="javascript:alert(1)"></head></html>`,
      ),
    );

    const meta = await scrapeMetadata("https://example.com");

    expect(meta.image).toBeNull();
  });

  test("never fetches an internal address", async () => {
    const fetchSpy = spyOn(global, "fetch");
    setHostResolver(async () => ["169.254.169.254"]);

    const meta = await scrapeMetadata("http://metadata.internal/latest/meta-data/");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(meta.title).toBe("metadata.internal");
    expect(meta.image).toBeNull();
  });

  test("follows a redirect to a public URL", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    const fetchSpy = spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/final" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(`<html><head><title>Redirected</title></head></html>`),
      );

    const meta = await scrapeMetadata("https://example.com/start");

    expect(meta.title).toBe("Redirected");
    expect(meta.domain).toBe("example.com");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test("refuses a redirect that points back into the private network", async () => {
    setHostResolver(async (hostname) =>
      hostname === "example.com" ? [PUBLIC_IP] : ["169.254.169.254"],
    );
    const fetchSpy = spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      }),
    );

    const meta = await scrapeMetadata("https://example.com/start");

    // Only the first hop is ever requested.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(meta.title).toBe("example.com");
  });

  test("stops reading the body past the size cap", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    // 5MB of markup before the title, so the cap has to cut the read short for
    // the title to be missing from what the parser sees. The cap is 2MB (raised
    // from 512KB while fixing the missing-cover bug — see MAX_HTML_BYTES), so
    // 600KB would no longer be enough to trip it.
    const body = "x".repeat(5 * 1024 * 1024) + "<title>Way Late Title</title>";
    spyOn(global, "fetch").mockResolvedValue(new Response(body));

    const meta = await scrapeMetadata("https://example.com/huge");

    // The guard is a real ceiling, not a suggestion: the page was truncated and
    // the tail never reached the parser.
    expect(meta.title).toBe("example.com");
  });

  test("gives up after too many redirects", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    const fetchSpy = spyOn(global, "fetch").mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/loop" },
      }),
    );

    const meta = await scrapeMetadata("https://example.com/loop");

    expect(fetchSpy).toHaveBeenCalledTimes(4); // initial hop + 3 redirects
    expect(meta.title).toBe("example.com");
  });
});

/**
 * The measured "title but no cover" bug.
 *
 * `<title>` sits early in `<head>` and `og:image` frequently sits much later,
 * so the body cap used to truncate between them and every affected save kept its
 * title and lost its cover. These pin both shapes that cause it.
 */
describe("og:image beyond a large head", () => {
  const PADDING = "<p>" + "x".repeat(600_000) + "</p>";

  beforeEach(() => setHostResolver(async () => [PUBLIC_IP]));

  test("survives a huge head (the originally reported repro)", async () => {
    // Half a megabyte of inline markup inside <head>, before the og:image.
    spyOn(global, "fetch").mockResolvedValue(
      new Response(
        `<html><head><title>Real Title</title>${PADDING}` +
          `<meta property="og:image" content="https://example.com/late.jpg"></head></html>`,
      ),
    );

    const meta = await scrapeMetadata("https://example.com/page");

    expect(meta.title).toBe("Real Title");
    expect(meta.image).toBe("https://example.com/late.jpg");
  });

  test("survives a huge body", async () => {
    spyOn(global, "fetch").mockResolvedValue(
      new Response(
        `<html><head><title>T</title>` +
          `<meta property="og:image" content="https://example.com/b.jpg"></head>` +
          `<body>${PADDING}</body></html>`,
      ),
    );

    const meta = await scrapeMetadata("https://example.com/page");

    expect(meta.image).toBe("https://example.com/b.jpg");
  });

  test("still reads metadata that lives in the body", async () => {
    // No <head> at all, so head-preferential extraction must pass through.
    spyOn(global, "fetch").mockResolvedValue(
      new Response(
        `<html><body><title>Body Title</title>` +
          `<meta property="og:image" content="https://example.com/c.jpg"></body></html>`,
      ),
    );

    const meta = await scrapeMetadata("https://example.com/page");

    expect(meta.title).toBe("Body Title");
    expect(meta.image).toBe("https://example.com/c.jpg");
  });
});

describe("headFirstHtml", () => {
  test("keeps only the head when one is present", () => {
    const result = headFirstHtml(
      `<html><head><title>T</title></head><body>noise</body></html>`,
    );

    expect(result).toBe("<head><title>T</title>");
  });

  test("tolerates whitespace and attributes on the head tag", () => {
    const result = headFirstHtml(
      `<head lang="en" ><title>T</title></head><body>x</body>`,
    );

    expect(result).toContain("<title>T</title>");
    expect(result).not.toContain("body");
  });

  test("returns the page untouched when there is no head", () => {
    const page = `<body><title>T</title></body>`;
    expect(headFirstHtml(page)).toBe(page);
  });

  test("returns the page untouched when the head is never closed", () => {
    const page = `<head><title>T</title>`;
    expect(headFirstHtml(page)).toBe(page);
  });

  test("ignores a <head> appearing deep in the body", () => {
    // Slicing to a `</head>` string found in the body would throw away the real
    // head, so only the prefix is searched.
    const filler = "x".repeat(300_000);
    const page = `<head><title>Real</title></head><body>${filler}<head></head></body>`;

    expect(headFirstHtml(page)).toContain("Real");
  });
});

describe("retry classification", () => {
  // The enrichment job retries on `retryable`, so misclassifying here either
  // burns four fetches on a dead URL or silently gives up on a blip.
  afterEach(() => {
    mock.restore();
    resetHostResolver();
  });

  test("marks a successful scrape ok", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    spyOn(global, "fetch").mockResolvedValue(
      new Response(`<html><head><title>Fine</title></head></html>`),
    );

    const meta = await scrapeMetadata("https://example.com");

    expect(meta.ok).toBe(true);
    expect(meta.retryable).toBeUndefined();
  });

  test("marks a timeout retryable", async () => {
    spyOn(global, "fetch").mockRejectedValue(new Error("timeout"));

    const meta = await scrapeMetadata("https://example.com/slow");

    expect(meta.ok).toBe(false);
    expect(meta.retryable).toBe(true);
    expect(meta.reason).toBe("timeout");
  });

  test("marks a 404 permanent", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    spyOn(global, "fetch").mockResolvedValue(new Response("gone", { status: 404 }));

    const meta = await scrapeMetadata("https://example.com/gone");

    expect(meta.ok).toBe(false);
    // A 404 will still be a 404 on the fifth attempt.
    expect(meta.retryable).toBe(false);
  });

  test("marks a 429 retryable", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    spyOn(global, "fetch").mockResolvedValue(new Response("slow down", { status: 429 }));

    const meta = await scrapeMetadata("https://example.com/busy");

    // The clearest possible "come back later".
    expect(meta.retryable).toBe(true);
  });

  test("marks a 5xx retryable", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    spyOn(global, "fetch").mockResolvedValue(new Response("boom", { status: 503 }));

    expect((await scrapeMetadata("https://example.com/x")).retryable).toBe(true);
  });

  test("marks an SSRF refusal permanent", async () => {
    setHostResolver(async () => ["10.0.0.5"]);

    const meta = await scrapeMetadata("http://internal.svc/bookmarks");

    // Retrying a private address would just be four more refused fetches.
    expect(meta.ok).toBe(false);
    expect(meta.retryable).toBe(false);
  });

  test("treats a page legitimately titled as a hostname as success", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    spyOn(global, "fetch").mockResolvedValue(
      new Response(`<html><head><title>example.com</title></head></html>`),
    );

    // This is why `ok` exists and "is the title still a hostname" does not:
    // a successful parse can legitimately produce that exact title.
    expect((await scrapeMetadata("https://example.com")).ok).toBe(true);
  });
});