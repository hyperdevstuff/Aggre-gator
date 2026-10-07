/**
 * shoot.mjs — render one hairline page at a fixed pose and write a static SVG
 * with the wet-slate palette baked in, ready to drop into a landing frame.
 *
 *   node shoot.mjs <name> <at> <intensity> <out.svg>
 *
 * `<at>` is the viewBox point the pointer is held at (x,y), `<intensity>` the
 * slider value. The page is read in a headless browser, and the figure's own
 * classes are re-bound to the landing palette, so the geometry on disk is the
 * geometry that ships.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/home/hyper/.cache/hairline-look/node_modules/playwright-core");

const [name, at, intensity, out] = process.argv.slice(2);
if (!name || !at || !out) {
  console.error("usage: node shoot.mjs <name> <at=x,y> <intensity> <out.svg>");
  process.exit(1);
}

const PALETTE = {
  dark: {
    plate: "oklch(0.205 0.010 215)",
    hi: "oklch(0.965 0.004 215)",
    edge: "oklch(0.50 0.014 215)",
    mid: "oklch(0.36 0.013 215)",
    lo: "oklch(0.27 0.012 215)",
  },
  light: {
    plate: "#ffffff",
    hi: "oklch(0.20 0.012 215)",
    edge: "oklch(0.55 0.014 215)",
    mid: "oklch(0.74 0.013 215)",
    lo: "oklch(0.86 0.012 215)",
  },
};

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });

for (const theme of ["dark", "light"]) {
  const url = "file://" + process.cwd() + `/hairline-${name}.html`
    + `?theme=${theme}&at=${at}&intensity=${intensity}`;
  await page.goto(url);
  await page.waitForTimeout(1600);
  const svg = await page.evaluate(() => {
    const s = document.querySelector("[data-hairline] > svg");
    return s ? s.outerHTML : null;
  });
  if (!svg) throw new Error("no svg found in " + url);
  writeFileSync(out.replace(/\.svg$/, `-${theme}.svg`), recolour(svg, PALETTE[theme], name));
  console.log("wrote", out.replace(/\.svg$/, `-${theme}.svg`));
}

await browser.close();

/** Rebind the kernel's five palette variables to the landing tokens, then crop to the artwork. */
function recolour(svg, P, name) {
  const means = {
    rack: "Nine pegs on a board with a link clipped to most. The nearest peg holds its card up.",
    pigeonholes: "A sorting wall of nine pockets in three rows. One card slides clear of its slot.",
    sheaf: "A shelf of three banded bundles. One is lifted clear of the shelf.",
  }[name];

  const css = `<style>
  path{fill:${P.plate};stroke:${P.mid};stroke-width:0.9;stroke-linejoin:round;stroke-linecap:round}
  .nf{fill:none}
  .fo{stroke:none}
  .sil{stroke:${P.edge}}
  .hi{stroke:${P.hi};stroke-width:1.1}
  .lo{stroke:${P.lo}}
  .dash{stroke-dasharray:3 3}
  circle.dot{stroke:none;fill:${P.hi}}
  circle.dot.m{fill:${P.edge}}
  circle.dot.off{fill:${P.lo}}
</style>`;

  let body = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  body = body.replace(/<style[\s\S]*?<\/style>/g, "");
  // the reflection mask carries a linearGradient the landing page has no use for
  body = body.replace(/<mask[\s\S]*?<\/mask>/g, "");
  body = body.replace(/\smask="[^"]*"/g, "");

  // crop to the drawn artwork so the figure fills its box on the page
  const box = bounds(body);
  const pad = 5;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x - pad} ${box.y - pad} ${box.w + pad * 2} ${box.h + pad * 2}" role="img" aria-label="${means}">`;
  return head + css + body + "</svg>\n";
}

function bounds(body) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const m of body.matchAll(/\sd="([^"]+)"/g)) {
    for (const t of m[1].matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
      const x = +t[1], y = +t[2];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  for (const m of body.matchAll(/cx="(-?[\d.]+)" cy="(-?[\d.]+)"/g)) {
    const x = +m[1], y = +m[2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x0 > x1) throw new Error("nothing drawn");
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
