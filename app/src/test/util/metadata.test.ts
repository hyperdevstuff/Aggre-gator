import { describe, test, expect, spyOn } from "bun:test";
import scrapeMetadata from "../../utils/metadata";

describe("metadata scraping", () => {
  test("falls back to hostname on fetch failure", async () => {
    spyOn(global, "fetch").mockRejectedValue(new Error("timeout"));

    const meta = await scrapeMetadata("https://example.com/page");

    expect(meta.title).toBe("example.com");
    expect(meta.domain).toBe("example.com");
  });

  test("extracts metadata from valid html", async () => {
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
  });
});
