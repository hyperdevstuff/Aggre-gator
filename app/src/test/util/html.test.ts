import { describe, expect, test } from "bun:test";
import {
  clampText,
  escapeHtml,
  renderCrawlerDocument,
} from "../../utils/html";

describe("escapeHtml", () => {
  test("escapes every character that can break out of markup", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("it's")).toBe("it&#39;s");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  test("escapes the ampersand first so entities are not double-broken", () => {
    // `&lt;` must become `&amp;lt;`, not `&lt;`.
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  test("is a no-op for ordinary text", () => {
    expect(escapeHtml("Design inspiration — notes & links")).toBe(
      "Design inspiration — notes &amp; links",
    );
    expect(escapeHtml("Plain text 123")).toBe("Plain text 123");
  });
});

describe("clampText", () => {
  test("leaves short text alone", () => {
    expect(clampText("Short", 100)).toBe("Short");
  });

  test("collapses whitespace so a preview is one clean line", () => {
    expect(clampText("a\n\n  b\t c", 100)).toBe("a b c");
  });

  test("clips on a word boundary without adding an ellipsis", () => {
    const text = "the quick brown fox jumps over the lazy dog";
    const out = clampText(text, 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(false);
    expect(out.endsWith("dog")).toBe(false);
    expect(text.startsWith(out)).toBe(true);
  });

  test("falls back to a hard cut when there is no usable space", () => {
    const out = clampText("a".repeat(50), 10);
    expect(out).toBe("a".repeat(10));
  });
});

describe("renderCrawlerDocument", () => {
  const base = {
    title: "Design Inspiration",
    url: "https://app.example.com/u/alice/design-inspiration",
  };

  test("emits the Open Graph and Twitter card tags", () => {
    const html = renderCrawlerDocument({
      ...base,
      description: "Links worth keeping",
      image: "https://app.example.com/og/collection/abc.png",
    });
    expect(html).toContain('<meta property="og:title" content="Design Inspiration">');
    expect(html).toContain('<meta property="og:description" content="Links worth keeping">');
    expect(html).toContain('<meta property="og:image" content="https://app.example.com/og/collection/abc.png">');
    expect(html).toContain('<meta property="og:url" content="https://app.example.com/u/alice/design-inspiration">');
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:site_name" content="Aggregator">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  test("emits a canonical link", () => {
    const html = renderCrawlerDocument(base);
    expect(html).toContain(
      '<link rel="canonical" href="https://app.example.com/u/alice/design-inspiration">',
    );
  });

  test("downgrades the card to `summary` when there is no image", () => {
    const html = renderCrawlerDocument(base);
    expect(html).toContain('<meta name="twitter:card" content="summary">');
    expect(html).not.toContain("og:image");
  });

  test("escapes a hostile collection name in both text and attributes", () => {
    // The security-critical case: these values are user-controlled and are
    // rendered by a third party. What matters is that no tag survives — the
    // payload text may still appear, but inert and escaped.
    const html = renderCrawlerDocument({
      title: '"><script>alert(1)</script>',
      description: "</title><script>alert(2)</script>",
      url: 'https://example.com/"><script>alert(3)</script>',
      image: 'https://example.com/x.png"><script>alert(4)</script>',
    });
    expect(html).not.toContain("<script");
    expect(html).not.toContain("</script");
    expect(html).not.toContain("<title></title>");
    // The payloads survive as escaped text rather than being stripped, so the
    // preview still shows what the owner typed.
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  test("neutralises a quote-breakout in an attribute", () => {
    // `onload="…"` is the classic vector: the quote must not survive.
    const html = renderCrawlerDocument({
      ...base,
      title: '" onload="alert(1)',
    });
    expect(html).not.toContain('onload="alert');
    expect(html).toContain("&quot;");
  });

  test("is a well-formed document with a readable body", () => {
    const html = renderCrawlerDocument({ ...base, description: "Some words" });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html lang=\"en\">");
    expect(html).toContain("</html>");
    expect(html).toContain("<h1>Design Inspiration</h1>");
    expect(html).toContain("<p>Some words</p>");
    // It is deliberately not a shell for the SPA (ADR-002).
    expect(html).not.toContain("<script");
  });

  test("truncates an over-long title", () => {
    const html = renderCrawlerDocument({ ...base, title: "word ".repeat(60) });
    // No ellipsis glyph — some previews render it literally.
    expect(html).not.toContain("…");
    expect(html.length).toBeLessThan(3000);
  });
});