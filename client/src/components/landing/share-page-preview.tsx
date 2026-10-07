import { motion, useReducedMotion } from "motion/react";
import { Check, FolderIcon } from "lucide-react";

/**
 * Static preview of the public share page.
 *
 * Deliberately mirrors the markup in `routes/share.$code.tsx` so the hero
 * shows the real thing rather than a stylised approximation. All content is a
 * module constant — nothing is fetched, nothing is an <img>, so it renders on
 * first paint and can never go stale.
 */

const PREVIEW = {
  shareCode: "k7f2q",
  collection: {
    name: "Design engineering reading list",
    description:
      "Everything worth re-reading before touching a scroll-driven interface.",
  },
  sharedBy: "Mira Kovač",
  bookmarkCount: 24,
  nested: [
    { name: "Foundations", count: 8 },
    { name: "Motion", count: 9 },
    { name: "Case studies", count: 7 },
  ],
  bookmarks: [
    {
      domain: "developer.mozilla.org",
      title: "Scroll-driven animations — CSS | MDN",
      description:
        "The reference for attach(), timelines and how they degrade when unsupported.",
      tags: ["css", "reference"],
    },
    {
      domain: "emilkowal.ski",
      title: "The element sizes you never asked for",
      description:
        "A tour of the intrinsic sizing keywords that quietly ruin every layout you have ever written.",
      tags: ["layout"],
    },
    {
      domain: "motion.dev",
      title: "Transitions: enter, exit, and interrupt",
      description:
        "Why a cancelled animation needs a different exit than a completed one.",
      tags: ["motion", "ux"],
    },
    {
      domain: "tympanus.net",
      title: "Grid-based layout ideas",
      description:
        "Twenty-six ways to break a grid — useful mostly for knowing what not to ship.",
      tags: [],
    },
  ],
};

export function SharePagePreview() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Glow */}
      <div
        aria-hidden
        className="landing-glow pointer-events-none absolute -inset-x-8 -top-8 bottom-0 -z-10 rounded-4xl"
      />

      <motion.div
        initial={reduceMotion ? false : { y: 24, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        className="landing-tilt"
      >
        <motion.div
          initial={reduceMotion ? false : { rotateX: 9, scale: 0.97 }}
          whileInView={{ rotateX: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
          className="landing-tilt-child"
        >
          {/* Browser chrome */}
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-2xl shadow-black/10 backdrop-blur-xl dark:shadow-black/40">
            <div className="flex items-center gap-3 border-b border-border/70 bg-muted/40 px-4 py-2.5">
              <div className="flex shrink-0 gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-traffic-close/80" />
                <span className="size-2.5 rounded-full bg-traffic-minimize/80" />
                <span className="size-2.5 rounded-full bg-traffic-maximize/80" />
              </div>
              <div className="mx-auto flex max-w-xs flex-1 items-center gap-2 rounded-md bg-background/70 px-2.5 py-1 ring-1 ring-border/60">
                <LockIcon />
                <span className="truncate font-mono text-xs text-muted-foreground">
                  aggregator.app/share/{PREVIEW.shareCode}
                </span>
              </div>
            </div>

            {/* Collection hero */}
            <div className="border-b border-border/60 px-5 py-5 sm:px-7 sm:py-7">
              <div className="flex items-start gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FolderIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                    {PREVIEW.collection.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 max-w-xl text-xs text-muted-foreground sm:text-sm">
                    {PREVIEW.collection.description}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>shared by {PREVIEW.sharedBy}</span>
                    <span aria-hidden>•</span>
                    <span>{PREVIEW.bookmarkCount} bookmarks</span>
                    <span aria-hidden>•</span>
                    <span>{PREVIEW.nested.length + 1} collections</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Nested collection pills */}
            <div className="flex items-center gap-2 overflow-hidden border-b border-border/60 px-5 py-2.5 sm:px-7">
              <span className="shrink-0 text-xs text-muted-foreground">
                includes:
              </span>
              {PREVIEW.nested.map((nested) => (
                <span
                  key={nested.name}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                >
                  <FolderIcon className="size-3 text-muted-foreground" />
                  {nested.name}
                  <span className="text-muted-foreground">
                    ({nested.count})
                  </span>
                </span>
              ))}
            </div>

            {/* Bookmark grid */}
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-4">
              {PREVIEW.bookmarks.map((bookmark) => (
                <div
                  key={bookmark.title}
                  className="flex flex-col rounded-xl border border-border/60 bg-card p-3.5"
                >
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {bookmark.title}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {bookmark.description}
                  </p>
                  <div className="mt-auto pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        aria-hidden
                        className="flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-semibold uppercase"
                      >
                        {bookmark.domain[0]}
                      </span>
                      <span className="truncate">{bookmark.domain}</span>
                    </div>
                    {bookmark.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {bookmark.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Confirmation chip — pops once, then stays */}
      <motion.div
        initial={reduceMotion ? false : { y: 8, opacity: 0, scale: 0.92 }}
        whileInView={{ y: 0, opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 22,
          delay: 0.55,
        }}
        className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-border/80 bg-popover px-3.5 py-2 text-xs font-medium shadow-lg shadow-black/10 sm:-bottom-5 sm:left-6 sm:translate-x-0"
      >
        <span className="flex size-4 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-3" />
        </span>
        Link copied to clipboard
      </motion.div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-3 shrink-0 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="10" x="5" y="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
