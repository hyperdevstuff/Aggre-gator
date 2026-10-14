import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";

/**
 * Open Graph card rendering (1200×630), served from the API.
 *
 * Two traps this file exists to respect, both from people who hit them:
 *
 *  1. **Satori is flexbox-only.** No CSS grid, no `position: absolute`, and no
 *     `text-overflow: ellipsis` — strings are truncated by hand in
 *     `truncate()`. Every element with children needs an explicit
 *     `display: flex` or `display: none`.
 *  2. **Fonts must be raw `.ttf`/`.otf`/`.woff` bytes.** The woff2 files in
 *     `client/public/fonts/` make satori throw `Unsupported OpenType signature
 *     wOF2`, and the Google Fonts *CSS* endpoint serves woff2 — so the fonts are
 *     vendored as TrueType in `app/assets/fonts/` instead.
 *
 * Decided in `docs/decisions/002-public-page-rendering.md`.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * Walk up from `start` looking for `relative`, returning the first match.
 *
 * Both the fonts and resvg's `.wasm` are resolved this way rather than by
 * hard-coded relative paths. The production image bundles the API to
 * `app/dist/index.js` — one directory deeper than `app/src/og/render.ts` — so a
 * fixed `../../assets/fonts` points at `/srv/assets/fonts` in the container and
 * at the right place only when running from source. Walking up is the same
 * trick Node's own module resolution uses.
 */
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

/** Font bytes are immutable for the process lifetime; parse them once. */
let fontsPromise: Promise<Array<{ name: string; data: Buffer; weight: 400 | 500 }>> | null =
  null;

async function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const faces = [
        { file: "Geist-Regular.ttf", weight: 400 as const },
        { file: "Geist-Medium.ttf", weight: 500 as const },
      ];
      const moduleDir = dirname(fileURLToPath(import.meta.url));
      const loaded: Array<{ name: string; data: Buffer; weight: 400 | 500 }> = [];
      for (const face of faces) {
        // Try `<ancestor>/assets/fonts/<file>`, which covers both
        // `app/assets/fonts` (source) and the same path relative to the bundle.
        const path =
          findUp(moduleDir, ["assets", "fonts", face.file]) ??
          findUp(moduleDir, ["app", "assets", "fonts", face.file]);
        if (!path) {
          console.error(`[og] font not found walking up from ${moduleDir}: ${face.file}`);
          continue;
        }
        loaded.push({
          name: "Geist",
          data: await readFile(path),
          weight: face.weight,
        });
      }
      return loaded;
    })();
  }
  const fonts = await fontsPromise;
  if (fonts.length === 0) {
    throw new Error(
      "no OpenType fonts available for OG rendering — expected app/assets/fonts/*.ttf",
    );
  }
  return fonts;
}

/**
 * Truncate by character count, appending an ellipsis when cut.
 *
 * Hand-rolled because satori ignores `text-overflow: ellipsis`, and silently
 * rendering an over-long title that runs off the card looks broken.
 */
export function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, Math.max(0, max - 1));
  const lastSpace = cut.lastIndexOf(" ");
  const stem = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${stem.trimEnd()}…`;
}

export type OgCardInput = {
  /** The big headline — a collection name, or `@handle`. */
  title: string;
  /** Small line above the title. */
  eyebrow?: string;
  /** Supporting line below the title. */
  subtitle?: string;
  /** Bottom-left meta line, e.g. "42 bookmarks". */
  meta?: string;
};

type Element = Record<string, unknown>;

/**
 * The card layout. Flexbox only, per the satori constraint above.
 */
function buildTree(input: OgCardInput): Element {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        // Explicit pixel size, not `100%`: Yoga treats a percentage as
        // content-box, so a `100%` root plus padding produced a 1344×774 card
        // and pushed the bottom row to y=681, clipped off the canvas. Sizing
        // the root in pixels and letting a `flexGrow` wrapper carry the padding
        // keeps the box exact with the padding *inside* it.
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        backgroundColor: "#0b0f14",
        backgroundImage:
          "radial-gradient(circle at 18% 12%, #16212b 0%, #0b0f14 55%)",
        color: "#e6edf3",
        fontFamily: "Geist",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              padding: "72px",
            },
            children: buildContent(input),
          },
        },
      ],
    },
  };
}

/** The three rows inside the padded wrapper. Flexbox only. */
function buildContent(input: OgCardInput): Element[] {
  return [
    // Top row: mark + eyebrow
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "#1f6feb",
                    color: "#ffffff",
                    fontSize: 24,
                    fontWeight: 500,
                  },
                  children: "A",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    marginLeft: 18,
                    fontSize: 26,
                    color: "#8b98a5",
                  },
                  children: input.eyebrow ?? "Aggregator",
                },
              },
            ],
          },
        },

        // Middle: title + subtitle.
        // `flexGrow` + `justifyContent: center` rather than relying on the
        // root's `space-between`, which satori does not distribute across three
        // children the way a browser would — the bottom row silently fell off
        // the canvas.
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flexGrow: 1,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: 68,
                    fontWeight: 500,
                    lineHeight: 1.12,
                    letterSpacing: "-0.02em",
                  },
                  // 52 keeps a long name to ~3 lines at 68px, which still leaves the bottom
                  // row clear of the subtitle instead of crowding it.
                  children: truncate(input.title, 52),
                },
              },
              ...(input.subtitle
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          marginTop: 22,
                          fontSize: 30,
                          lineHeight: 1.35,
                          color: "#8b98a5",
                        },
                        children: truncate(input.subtitle, 120),
                      },
                    },
                  ]
                : []),
            ],
          },
        },

        // Bottom row: meta
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", fontSize: 26, color: "#8b98a5" },
                  children: input.meta ?? "app.example.com",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: 26,
                    color: "#4d5b68",
                  },
                  children: "aggregator",
                },
              },
            ],
          },
        },
  ];
}

let wasmReady: Promise<void> | null = null;

/**
 * Initialise resvg's WASM module once.
 *
 * `@resvg/resvg-wasm` cannot reliably locate its own `.wasm` under every
 * bundler or working directory, so the bytes are found explicitly and handed to
 * `initWasm`. This is also why the dependency survives `bunfig.toml`'s
 * `ignoreScripts = true`: it needs no native build step.
 */
async function initResvg(): Promise<void> {
  if (!wasmReady) {
    wasmReady = (async () => {
      const path = locateWasm();
      if (!path) {
        throw new Error(
          "could not locate resvg-wasm's index_bg.wasm by walking up from " +
            `${dirname(fileURLToPath(import.meta.url))}. Is @resvg/resvg-wasm installed?`,
        );
      }
      await initWasm(await readFile(path));
    })();
  }
  return wasmReady;
}

/**
 * Locate `index_bg.wasm`. This is a Bun workspace, so the package lands in
 * `/srv/node_modules` in the production image but in `app/node_modules` when
 * running tests from the repo — `findUp` finds either without encoding the
 * layout.
 */
function locateWasm(): string | undefined {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return (
    findUp(moduleDir, ["node_modules", "@resvg", "resvg-wasm", "index_bg.wasm"]) ??
    findUp(moduleDir, ["app", "node_modules", "@resvg", "resvg-wasm", "index_bg.wasm"])
  );
}

/** Render a 1200×630 PNG. Throws if fonts or WASM are unavailable. */
export async function renderOgCard(input: OgCardInput): Promise<Uint8Array> {
  const fonts = await loadFonts();
  await initResvg();

  const svg = await satori(buildTree(input) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}