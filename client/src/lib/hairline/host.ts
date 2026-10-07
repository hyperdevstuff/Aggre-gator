/**
 * The host that stands in for the skill's bench.
 *
 * A figure is written in the skill's own format: it reads the global `HL` and
 * ends with a call to the global `hairline({ … })`. The bench used to supply
 * those two globals, along with the stage, the svg and the read-out. Here we do
 * the same job inside React, which means a figure file stays byte-for-byte in
 * the format `build.mjs` and `look.mjs` expect — you can still build the page
 * and run the eight-picture look on any of them.
 *
 * The kernel is injected once per document; each figure is then fetched from
 * `/public` and imported as a module so it evaluates in its own scope (several
 * figures on one page would otherwise collide on their top-level `const`s).
 */

export type HairlineRange = readonly [number, number, number];

export type HairlineRead = {
  textContent: string | null;
};

export type HairlineHandle = {
  set(value: number): void;
  /** The scroll hook. Same code path the pointer uses, so scroll and hover agree. */
  focus?(i: number): void;
  destroy(): void;
};

export type HairlineSpec = {
  name: string;
  means: string;
  rules: number[];
  range: HairlineRange;
  mount(
    ctx: { stage: HTMLElement; svg: SVGElement; read: HairlineRead },
    value: number,
  ): HairlineHandle;
};

/** The slice of the kernel a host touches. The figure gets the whole of it. */
type Kernel = {
  inject(root: Document | HTMLElement): void;
  mk(tag: string, attrs: Record<string, string>, parent: Element): SVGElement;
};

declare global {
  interface Window {
    HL?: Kernel;
    hairline?: (spec: HairlineSpec) => void;
  }
}

/**
 * The slider is 0…1; a figure's own number is its three-point `range`, with the
 * middle as the default. Two straight lines that meet at 0.5 — the bench's own
 * mapping, kept identical so a figure looks the same here as on its page.
 */
export function valueAt(range: HairlineRange, intensity: number): number {
  const [lo, mid, hi] = range;
  const t = intensity <= 0.5 ? lo + (intensity / 0.5) * (mid - lo) : mid + ((intensity - 0.5) / 0.5) * (hi - mid);
  return Math.round(t * 1000) / 1000;
}

let kernel: Promise<Kernel> | null = null;

function injectKernel(): Promise<Kernel> {
  if (window.HL) {
    window.HL.inject(document);
    return Promise.resolve(window.HL);
  }

  return new Promise<Kernel>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "/hairline/kernel.js";
    el.async = true;
    el.addEventListener("load", () => {
      if (!window.HL) {
        reject(new Error("hairline: kernel.js loaded but HL is missing"));
        return;
      }
      window.HL.inject(document);
      resolve(window.HL);
    });
    el.addEventListener("error", () => reject(new Error("hairline: kernel.js failed to load")));
    document.head.append(el);
  });
}

/** Idempotent. Every figure waits on this before it evaluates. */
export function loadKernel(): Promise<Kernel> {
  kernel ??= injectKernel().catch((error: unknown) => {
    kernel = null;
    throw error;
  });
  return kernel;
}

/**
 * Imports are serialised: the figure's registration call goes to one global,
 * so two figures loading at once would race for it.
 */
let queue: Promise<unknown> = Promise.resolve();

const specs = new Map<string, HairlineSpec>();

async function importFigure(name: string): Promise<HairlineSpec> {
  const cached = specs.get(name);
  if (cached) return cached;

  await loadKernel();

  const res = await fetch(`/${name}.js`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`hairline: /${name}.js is missing (${res.status})`);

  const source = await res.text();
  const pending: HairlineSpec[] = [];
  const previous = window.hairline;

  window.hairline = (spec) => pending.push(spec);
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
    window.hairline = previous;
  }

  const spec = pending[pending.length - 1];
  if (!spec) throw new Error(`hairline: /${name}.js did not register a figure`);
  specs.set(name, spec);
  return spec;
}

/** Cached after the first call, so a switcher can flip back and forth freely. */
export function loadFigure(name: string): Promise<HairlineSpec> {
  const run = queue.then(
    () => importFigure(name),
    () => importFigure(name),
  );
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Mounts a figure into `host`. `host` must be empty; the svg and the live
 * region are created here, exactly as the bench created them.
 */
export function mountFigure(
  spec: HairlineSpec,
  host: HTMLElement,
  value: number,
): HairlineHandle {
  const k = window.HL;
  if (!k) throw new Error("hairline: mountFigure called before the kernel loaded");

  host.replaceChildren();
  host.setAttribute("data-hairline", spec.name);
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", spec.means);

  const svg = k.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, host);

  // The read-out is read, not seen: the kernel styles this as visually hidden.
  const live = document.createElement("div");
  live.setAttribute("data-hairline-live", "");
  live.setAttribute("role", "status");
  host.append(live);

  let text: string | null = null;
  const read: HairlineRead = {
    get textContent() {
      return text;
    },
    set textContent(value: string | null) {
      text = value == null ? "" : String(value);
      live.textContent = text;
    },
  };

  const handle = spec.mount({ stage: host, svg, read }, value);
  if (text === null) read.textContent = "rest";
  return handle;
}