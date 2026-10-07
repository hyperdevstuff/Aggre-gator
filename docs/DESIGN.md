# Design System & Landing — build log

> Written 2026-10-07. Thesis: `docs/SPEC.md` · Plan: `docs/ROADMAP.md` ·
> Status: `docs/TASKS.md`.
> Canvas: https://doop.design/c/dAlcFDEPL1 — 18 frames, plus two style guides
> (`design-system`, `hairline-figures`) that persist the rules for later work.
>
> **Status: the tokens are in the repo.** `client/src/index.css` carries the
> wet-slate block (`[data-wet-slate]`, `--hairline-*`, `meta-sm`), and the
> figures run in-app via `components/hairline/figure.tsx` + `lib/hairline/host.ts`.
> The frames themselves live on the Doop canvas and in `client/public/`.

---

## 1. Product name

The brand is **Aggregator** — one word, capital A, double-g at the end. Never
"Aggre-gator" or "aggregator" in user-facing copy. The landing navbar carries the
logo mark alone; the `logo.tsx` + "Aggregator" lockup is for login and share pages.

The logo has **one path set**, drawn with `fill="currentColor"` and
`viewBox="0 0 250 250"`. `client/public/logo.svg` stays pure black for favicon and
OG only — it is never loaded directly on a dark ground.

---

## 2. Design system — "wet slate"

Blue-green tinted neutrals, so light and dark read as one material. One accent, and
it means **publish, share, or proof of readership**.

### Dark (primary)

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.16 0.008 215)` | page ground |
| `--card` | `oklch(0.205 0.010 215)` | resting surface |
| `--popover` | `oklch(0.245 0.011 215)` | floating |
| `--overlay` | `oklch(0.285 0.012 215)` | modal, command palette |
| `--foreground` | `oklch(0.965 0.004 215)` | primary ink |
| `--muted-fg` | `oklch(0.70 0.012 215)` | secondary ink |
| `--meta-fg` | `oklch(0.74 0.013 215)` | ink for floating surfaces |
| `--accent` (clay) | `oklch(0.78 0.14 32)` | share / live / view counts |
| `--border` | `oklch(1 0 0 / 9%)` | hairline |
| `--success` | `oklch(0.72 0.17 155)` | pass states |

### Light (parity)

| Token | Value |
|---|---|
| `--background` | `oklch(0.975 0.003 215)` |
| `--card` / `--popover` | `#fff` |
| `--foreground` | `oklch(0.20 0.012 215)` |
| `--muted-fg` | `oklch(0.28 0.014 215)` |
| `--accent` ink | `oklch(0.42 0.19 28)` |
| `--accent` fill | `oklch(0.70 0.14 28)` |
| `--border` | `oklch(0.20 0.012 215 / 10–14%)` |

### Contrast — measured, not estimated

I converted the whole OKLCH set to sRGB and computed real WCAG ratios rather than
guessing. **fg/ground 9.85:1**, fg/card 7.13:1, muted/ground 6.58:1,
muted/card 4.77:1, accent ink/ground 6.98:1, light fg/ground 7.46:1, light
muted/ground 4.84:1.

Three findings that changed the design:

- **White text on clay is 1.7:1.** Clay fills in dark mode take the *ground* as ink,
  never white. The same applies in light at `0.70 0.14 28`, where white is 4.5:1.
- **The tweakcn theme's light `muted` at `0.5517` is 2.20:1 on white** — well under
  AA. Its `--shadow-2xl` at 100% black also punches a hole in dark mode rather than
  lifting a surface. Both rejected.
- **Muting is not one variable.** On a light ground "muted" must be roughly `0.28`;
  on a dark ground roughly `0.70`. Reusing one lightness across both is how a token
  set fails its own audit.

### Elevation

No drop shadows in dark. Depth is surface lightness + a 1px hairline + a 6% white
inner top highlight. Light mode swaps the highlight for
`0 1px 2px rgb(0 0 0 / 0.05), 0 4px 20px -6px rgb(0 0 0 / 0.08)`.

### Radius — base 6px, asymmetric

`xs 4` micro chip · `sm 6` button/input · `md 8` · `lg 10` card · `xl 14`
modal/popover · full round for pills only.

### Type

- **Newsreader** (variable serif) — anything making a claim. d1 37/1.04 −0.028em ·
  d2 27/1.14 −0.02em · d3 20/1.30 −0.012em. Italic only for asides and collection
  subtitles, never a headline or button.
- **Geist** — lead 16/1.58, body 14/1.58, ui 13.5/1.50. Body measures 60–68ch.
- **Geist Mono** — machine facts only: share codes, counts, timestamps, eyebrows
  (11px, +0.09em, uppercase).

### Motion

- Durations **120 / 180 / 260**. Exit always faster than enter.
- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` · `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` ·
  `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`. **`ease-in` is banned** — it holds
  still at the moment the eye is watching hardest.
- Press feedback `scale(0.97)` at 120ms on every pressable surface.
- Never animate: keyboard-triggered palette, focus rings, hover tints. Enter from
  `scale(0.95)`, never `scale(0)`. Popovers scale from their trigger; only modals stay
  centred. Transitions over keyframes for anything retriggerable.

### Accent discipline

Clay appears on: the share button, the live dot on a published collection, view-count
numerals, and one rule under the active nav item. Under 5% of pixels. Never on
headings, icons, ordinary links, or gradients. **If clay is on screen twice in one
viewport, one of them is wrong.**

---

## 3. Landing page

Built section by section, each with its intent stated before it was built.

| Frame | Intent |
|---|---|
| `L1 · Hero` | State the thesis and prove it in one screen |
| `L2 · Tension` | Name the actual cost — why a list of links is expensive |
| `L3c · How it works` | Three steps, one hairline figure each |
| `L4 · The share page` | Show the artifact at full fidelity |
| `L5 · Capabilities` | Honest built-vs-next, straight from `SPEC.md` |
| `L6 · Pricing` | The ladder, with prices marked provisional |
| `L7 · Close + footer` | Restate the thesis, one CTA |
| `L0 · Full page (dark)` | Assembled, to judge vertical rhythm |
| `L0 · Full page (light)` | Same markup, tokens swapped only |

An earlier `L3b` (three hairline figures, longer copy) was **superseded** by `L3c`.

The positioning that came out of this work: **Pinterest for links, except someone
sorted them.** The differentiator is not saving — anyone can save a URL — it is
getting back a *list* in a deliberate order with reasons attached, which is the thing
an agent can actually be pointed at.

---

## 4. Hairline figures

Five isometric figures, one idea each, built with `hairline-create` and looked at in a
real browser (8 shots, 12 questions) before handover.

| Figure | Object | Gesture | Source |
|---|---|---|---|
| **press** | A stamping press | Pointer height drives the stamp down; a card rises out of the slot | `client/public/press.js` |
| **rack** | Nine pegs on a board | Nearest peg holds its card up; others tip toward it | `client/public/rack.js` |
| **pigeonholes** | A sorting wall, nine pockets in three rows | One card slides clear; its row steps forward | `client/public/pigeonholes.js` |
| **sheaf** | A shelf of three banded bundles | The chosen one lifts clear; others lean back | `client/public/sheaf.js` |
| **riffle** | Eight cards fanned in a tray | The card under the pointer stands up | `client/public/riffle.js` |
| **spread** | Latest; being judged as the landing hero | — | `client/public/spread.js` |

**The narrative.** press → pigeonholes → sheaf: a URL becomes a card, the card is
filed by depth, the collection is published whole. `pigeonholes`' three rows *are*
the 3-level nesting cap, so the geometry states the product rule without a caption.

Each returns `{ set, focus, destroy }`. **`focus(i)` is the scroll hook**, and it is
the same code path the pointer uses — so a scroll-driven step and a hover behave
identically. Scroll maps onto `range`, which for these figures is the figure's own
number rather than an abstract intensity: pegs loaded, world units clear, lift height.

### Running them in the app

`components/hairline/figure.tsx` + `lib/hairline/host.ts` stand in for the skill's
bench inside React. `host.ts` injects the kernel once per document, then fetches
`/<name>.js` and imports it as a module so several figures can share one page without
their top-level `const`s colliding. Imports are serialised, because each figure's
registration call targets the same global. A figure file stays byte-for-byte in the
format `build.mjs` and `look.mjs` expect.

`/landing-prototype` is the switcher: `spread`, `fan`, `rank`, `press`, `riffle`
as hero candidates. `fan` and `rank` are named there but have no `.js` in
`client/public/` yet — those tabs render an empty box by design.

Build and check:

```bash
node .agents/skills/hairline-create/build.mjs client/public/<name>.js
node .agents/skills/hairline-create/look.mjs client/public/<name>.js --answer x,y,z --edge x,y --edge x,y
```

Static assets for the landing page are regenerated with
`client/public/shoot.mjs <name> <at=x,y> <intensity> <out.svg>`, which drives the real
page in headless Chromium, holds the pose, strips the bench's reflection mask and
crops to the artwork bounds — so the SVG on the canvas is the geometry that ships.
It is a bench tool, not app code: `client/eslint.config.js` ignores `public/`.

Preview locally (Vite serves `public/` at the root, port **5180**):

```
http://localhost:5180/hairline-press.html
http://localhost:5180/hairline-press.html?w=240&theme=dark&at=217,178
http://localhost:5180/hairline-press-look.png
```

### Palette is CSS-var driven

Override `--hairline-plate / -hi / -edge / -mid / -lo`; never edit paths.

| Token | Dark | Light |
|---|---|---|
| `plate` | `oklch(0.205 0.010 215)` | `#ffffff` |
| `hi` | `oklch(0.965 0.004 215)` | `oklch(0.20 0.012 215)` |
| `edge` | `oklch(0.50 0.014 215)` | `oklch(0.55 0.014 215)` |
| `mid` | `oklch(0.36 0.013 215)` | `oklch(0.74 0.013 215)` |
| `lo` | `oklch(0.27 0.012 215)` | `oklch(0.86 0.012 215)` |

### Traps hit while building these

Worth writing down; each cost a build-and-look cycle.

- `SHAPE.map(corner)` passes `(point, index, array)`, so the mapper received the
  array as `u` and the index as `v` — every coordinate became `NaN`. Always
  `SHAPE.map((q) => f(q[0], q[1]))`.
- `ringAt(P, ring, z)` takes **three** arguments. A four-argument call silently yields
  `NaN` coordinates and the browser drops the path.
- A figure's `set(v)` must not be a no-op. If it routes through `setActive(a)`, which
  early-returns on an unchanged index, moving the slider does nothing visible.
- Hit planes must match the parts' actual height. Unprojecting at `z = 0` when the
  cards hang at the peg crown picks a neighbouring peg.
- Unused destructured imports are not free — a figure that references one it did not
  import fails silently at draw time, and `look.mjs` reports it as an empty SVG.

### A retracted bug claim

I reported that the riffle figure passed four arguments to `ringAt` and emitted
`NaN`. **That was wrong** — the slip was in a scratch extraction script, not in the
figure. The shipped `client/public/riffle.js` is correct and needs no fix. The
retraction is recorded on the canvas guide too.

---

## 5. Open items

**Not done, in rough priority order:**

1. **Beat 3 under-sells the product.** `sheaf` lifts one bundle off a shelf. The
   section claims "several collections can share a single page" — the flagship Pro
   feature — and the drawing does not show it. A figure that gathers several bundles
   into one share is the next build.
2. **The scroll section is not wired.** `L3c` shows three stills in a row. The
   real section needs pinning, `focus(i)` on step change, and pointer-wins-locally
   (scroll sets focus only when the pointer is off the stage; on touch, scroll is the
   only channel). `HairlineFigure` already exposes the `onHandle` hook for this.
3. **Public surfaces are not designed yet.** The palette has a live dot and
   view-count numerals reserved for a published collection, but the public profile,
   the readable collection page and Explore v2 have no frames. Those are phase 3–4
   of `ROADMAP.md`, and the design work should follow the API, not precede it.
4. **Logo legibility below ~32px.** The jaw and paperclip close into a smudge. It
   needs a real two-path cut — head and eye only for small sizes. Until that exists,
   the mark is not used under 24px.
5. **`sheaf` reads as loose plates** more than a bound bundle; the band is legible
   but small at 240px. Consider a wider band, or dropping to two bundles.
6. **`pigeonholes` is legible but plain** — it does not say "sorting" without its caption.
7. **`spread.js` has no written verdict** on the canvas yet; `fan` and `rank` are
   placeholder names in the prototype switcher with no figure behind them.
8. **Pricing is provisional.** `£0 / £6 / £14` are placeholders and the section says so.
