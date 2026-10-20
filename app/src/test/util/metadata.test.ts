import { describe, test, expect, afterEach, spyOn, mock } from "bun:test";
import scrapeMetadata, { TransientScrapeError } from "../../utils/metadata";
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

  test("surfaces a network failure so the queue can retry it", async () => {
    spyOn(global, "fetch").mockRejectedValue(new Error("timeout"));

    // Not swallowed into the hostname fallback any more: a timeout or a dropped
    // connection is the one case worth retrying, and retry belongs to the queue
    // (`utils/jobs.ts`), not to a silent fallback.
    await expect(scrapeMetadata("https://example.com/page")).rejects.toThrow(
      TransientScrapeError,
    );
  });

  test("falls back to the hostname on a permanent failure (404)", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    const meta = await scrapeMetadata("https://example.com/gone");

    expect(meta.title).toBe("example.com");
    expect(meta.image).toBeNull();
  });

  test("surfaces a 5xx as transient rather than a missing page", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 503 }));

    await expect(scrapeMetadata("https://example.com/down")).rejects.toThrow(
      TransientScrapeError,
    );
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
    // 600KB of plain markup before the title — nothing here is a `<script>`, so
    // it all counts against the 512KB we keep, and the title is cut off.
    const body = "x".repeat(600_000) + "<title>Late Title</title>";
    spyOn(global, "fetch").mockResolvedValue(new Response(body));

    const meta = await scrapeMetadata("https://example.com/huge");

    expect(meta.title).toBe("example.com");
  });

  test("finds metadata buried under a large inline bundle", async () => {
    setHostResolver(async () => [PUBLIC_IP]);
    // The measured cause of missing covers: the page front-loads its JS, so
    // `<title>` and `<meta og:image>` are separated by far more than the 512KB
    // cap. Dropping `<script>` bodies before the cap is applied is what keeps
    // both — a title with no cover was the exact symptom in the wild.
    const inline = `<script>${"var a=1;".repeat(80_000)}</script>`;
    spyOn(global, "fetch").mockResolvedValue(
      new Response(
        `<html><head><title>Real Title</title>${inline}` +
          `<meta property="og:image" content="https://example.com/buried.jpg">` +
          `</head></html>`,
      ),
    );

    const meta = await scrapeMetadata("https://example.com/buried");

    expect(meta.title).toBe("Real Title");
    expect(meta.image).toBe("https://example.com/buried.jpg");
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