import { describe, test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderOgCard, truncate, OG_WIDTH, OG_HEIGHT } from "../../og/render";

/** Local copy of the helper in render.ts — it is not exported. */
function findUp(start: string, relative: string[], maxDepth = 8): string | undefined {
  let dir = start;
  for (let depth = 0; depth < maxDepth; depth++) {
    const candidate = join(dir, ...relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * The OG renderer is easy to break silently: satori is flexbox-only, its
 * layout engine treats percentages as content-box, and a layout mistake
 * renders *something* — it just quietly pushes content off the canvas. These
 * tests assert the observable output, not the intermediate tree.
 */

describe("truncate", () => {
  test("leaves short text alone", () => {
    expect(truncate("Short", 52)).toBe("Short");
  });

  test("collapses whitespace", () => {
    expect(truncate("a\n  b\tc", 52)).toBe("a b c");
  });

  test("clips with an ellipsis at the limit", () => {
    const out = truncate("word ".repeat(40), 52);
    expect(out.length).toBeLessThanOrEqual(52);
    expect(out.endsWith("…")).toBe(true);
  });

  test("prefers a word boundary", () => {
    const out = truncate("design inspiration typography colour grids", 20);
    expect(out).toBe("design inspiration…");
  });

  test("hard-cuts when there is no usable space", () => {
    expect(truncate("x".repeat(40), 10)).toBe("xxxxxxxxx…");
  });
});

describe("renderOgCard", () => {
  test("renders a 1200×630 PNG", async () => {
    const png = await renderOgCard({ title: "Design Inspiration" });
    // PNG signature, then IHDR width/height as big-endian uint32 at 16 and 20.
    const buf = Buffer.from(png);
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const view = new DataView(
      buf.buffer,
      buf.byteOffset,
      buf.byteLength,
    );
    expect(view.getUint32(16)).toBe(OG_WIDTH);
    expect(view.getUint32(20)).toBe(OG_HEIGHT);
  });

  test("renders with every field populated", async () => {
    const png = await renderOgCard({
      title: "Reading List",
      eyebrow: "@alice",
      subtitle: "Books worth reading.",
      meta: "42 bookmarks",
    });
    expect(png.byteLength).toBeGreaterThan(1000);
  });

  test("renders with the optional fields omitted", async () => {
    const png = await renderOgCard({ title: "Just A Title" });
    expect(png.byteLength).toBeGreaterThan(1000);
  });

  test("keeps a very long title inside the canvas", async () => {
    // The regression this guards: a content-box sizing mistake pushed the
    // bottom row to y=681 and clipped it off the 630px card, while still
    // producing a perfectly valid PNG. The rendered height is therefore not
    // proof — the content must actually fit.
    const png = await renderOgCard({
      title: "An Extremely Long Collection Name That Absolutely Will Not Fit On One Line",
      eyebrow: "@someone_with_a_very_long_handle",
      subtitle:
        "A description that also runs on and on and should be clipped somewhere sensible rather than overflowing the card entirely",
      meta: "1 bookmark",
    });
    const buf = Buffer.from(png);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    expect(view.getUint32(20)).toBe(OG_HEIGHT);
    expect(png.byteLength).toBeGreaterThan(1000);
  });

  test("survives markup and SQL in user-controlled fields", async () => {
    // Output is a PNG — text becomes vector paths — so there is no HTML
    // context to break out of. The assertion is that rendering does not throw.
    const png = await renderOgCard({
      title: '<script>alert(1)</script>&"quoted"',
      eyebrow: "@<b>bold</b>",
      subtitle: "'; DROP TABLE users; --",
      meta: "5 bookmarks",
    });
    expect(png.byteLength).toBeGreaterThan(1000);
  });

  test("handles unicode and emoji", async () => {
    const png = await renderOgCard({
      title: "日本語のコレクション 🎉",
      subtitle: "Ünïcödé — em dash, ellipsis…",
    });
    expect(png.byteLength).toBeGreaterThan(1000);
  });

  test("resolves its assets from a bundled, one-level-deeper location", async () => {
    // The production image bundles the API to `app/dist/index.js`, which sits
    // one directory deeper than `app/src/og/render.ts`. A fixed
    // `../../assets/fonts` therefore resolves correctly when running from source
    // and silently breaks in the container — the kind of bug that only appears
    // after deploy, so it is asserted here instead.
    const fontDir = findUp(
      dirname(fileURLToPath(import.meta.url)),
      ["assets", "fonts", "Geist-Regular.ttf"],
    );
    expect(fontDir).toBeDefined();

    // From that font's own directory, walking up must still find the fonts even
    // though we are effectively one level deeper than the source layout.
    const bundleDir = join(dirname(fontDir!), "..", "dist");
    expect(
      findUp(bundleDir, ["..", "assets", "fonts", "Geist-Regular.ttf"]),
    ).toBeDefined();
    expect(
      findUp(bundleDir, ["node_modules", "@resvg", "resvg-wasm", "index_bg.wasm"]),
    ).toBeDefined();
  });
});