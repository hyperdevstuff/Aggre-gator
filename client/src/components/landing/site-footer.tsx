import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/ui/logo";
import { Wordmark } from "@/components/landing/wordmark";

/**
 * The closing footer, in the shape it already had: a brand block and two short
 * link columns over a utility row, with the wordmark at the foot. Four things put
 * right, and nothing moved:
 *
 * - "See an example" appeared in both columns, pointing at /explore twice. Gone;
 *   Explore lives in one column now.
 * - "curator's choice" said nothing to anyone who had not read the pricing table.
 *   Gone, and its slot goes to the line that does work.
 * - The brand was three separate things: a text label, a 24px glyph below it, and
 *   the wordmark. The label and the glyph are one lockup now, and the mark carries
 *   it — 40px against an 18px name, so the good mark is finally at a size that
 *   reads instead of sitting under a caption.
 * - "built for people with too many tabs" was tacked onto the copyright. It gets
 *   the utility row to itself.
 *
 * Notes ship on: each link carries a one-line description, so the column tells you
 * where a link goes before you click it. `notes={false}` drops them, which the lab
 * keeps around as the leaner reading.
 */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", to: "/#features", note: "What it does, and what it doesn't" },
      { label: "Pricing", to: "/#pricing", note: "Free tier, and what the paid one adds" },
      { label: "Explore", to: "/explore", note: "Collections people have published" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", to: "/login", note: "Return to your collections" },
      { label: "Create a collection", to: "/signup", note: "Free, no card" },
    ],
  },
];

export function SiteFooter({ notes = true }: { notes?: boolean }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-10">
        <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link
              to="/"
              aria-label="Aggregator — home"
              className="flex w-fit items-center gap-3 rounded-xl transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Logo className="size-10" />
              <span className="text-lg font-semibold tracking-tight">
                Aggregator
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm text-pretty text-muted-foreground">
              A public page for the links you mean to keep. Collect once, and the
              page stays current.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="meta-sm">{column.heading}</h2>
              <ul className="mt-4 flex flex-col gap-4">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm font-medium transition-colors hover:text-foreground/70 focus-visible:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {link.label}
                    </Link>
                    {notes && (
                      <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
                        {link.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-border/60 pt-6">
          <p className="text-xs text-muted-foreground">© {year} Aggregator</p>
          <p className="text-xs text-muted-foreground">
            Built for people with too many tabs
          </p>
        </div>
      </div>

      <Wordmark variant="reveal" />
    </footer>
  );
}
