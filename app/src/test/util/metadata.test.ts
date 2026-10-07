import { describe, test, expect, afterEach, spyOn, mock } from "bun:test";
import scrapeMetadata from "../../utils/metadata";
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
    // 600KB of markup before the title, so the cap has to cut the read short
    // for the title to be missing from what the parser sees.
    const body = "x".repeat(600_000) + "<title>Late Title</title>";
    spyOn(global, "fetch").mockResolvedValue(new Response(body));

    const meta = await scrapeMetadata("https://example.com/huge");

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