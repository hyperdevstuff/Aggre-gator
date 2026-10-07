import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/ui/logo";
import { Wordmark } from "@/components/landing/wordmark";

const COLUMNS = [
  {
    heading: "Page",
    links: [
      { label: "Features", to: "/#features" },
      { label: "Pricing", to: "/#pricing" },
      { label: "Explore", to: "/explore" },
    ],
  },
  {
    heading: "Use",
    links: [
      { label: "Sign in", to: "/login" },
      { label: "Create a collection", to: "/signup" },
      { label: "See an example", to: "/explore" },
    ],
  },
];

/**
 * The footer exactly as it shipped before this pass, kept only so the changes in
 * `site-footer.tsx` can be seen side by side in the lab. Not rendered anywhere
 * else; delete this file once the new footer is settled.
 */
export function FooterBefore() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <h2 className="meta-sm">Aggregator</h2>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              A public page for the links you mean to keep. Collect once, and the
              page stays current.
            </p>
            <Link
              to="/"
              aria-label="Aggregator — home"
              className="mt-5 flex w-fit items-center rounded-lg transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Logo className="size-6" />
            </Link>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="meta-sm">{column.heading}</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-border/60 pt-6">
          <p className="text-xs text-muted-foreground">
            © {year} · built for people with too many tabs
          </p>
          <p className="meta-sm">curator's choice</p>
        </div>
      </div>

      <Wordmark variant="reveal" />
    </footer>
  );
}
