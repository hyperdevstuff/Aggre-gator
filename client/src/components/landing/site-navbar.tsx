import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavLink = { label: string; to: string; hash?: string };

/**
 * The section links target the home route, not a bare `#hash`. A bare
 * `#features` only moves the hash on whatever page you are on, so from
 * `/explore` it scrolled nothing and left you there; `to="/"` plus `hash` goes
 * home first and then scrolls to the section, from anywhere.
 */
const NAV_LINKS: NavLink[] = [
  { label: "Features", to: "/", hash: "features" },
  { label: "Pricing", to: "/", hash: "pricing" },
  { label: "Explore", to: "/explore" },
];

/**
 * Scroll distance, in px, past which the bar switches to its compact width.
 * Small enough to feel immediate, large enough that a stray 1–2px nudge (or a
 * restored scroll position on reload) does not fire it.
 */
const COMPACT_AFTER = 24;

/**
 * True once the page has scrolled past `threshold`.
 *
 * Only ever flips on an actual crossing, so a continuous scroll does not
 * re-render — the comparison guards every call.
 */
function useScrolledPast(threshold: number) {
  const [passed, setPassed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.scrollY > threshold;
  });

  useEffect(() => {
    const onScroll = () => {
      setPassed((current) => {
        const next = window.scrollY > threshold;
        return next === current ? current : next;
      });
    };
    // A scroll already in flight before this listener attaches would be missed.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return passed;
}

function linkClasses(className?: string) {
  return cn(
    "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    className,
  );
}

function NavItem({ link, className }: { link: NavLink; className?: string }) {
  return (
    <Link to={link.to} hash={link.hash} className={linkClasses(className)}>
      {link.label}
    </Link>
  );
}

export function SiteNavbar() {
  const reduceMotion = useReducedMotion();
  const compact = useScrolledPast(COMPACT_AFTER);

  return (
    <motion.header
      className="fixed inset-x-0 top-4 z-50 px-4"
      initial={reduceMotion ? false : { y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
    >
      <div
        className="nav-bar-shell mx-auto"
        data-compact={compact || undefined}
      >
        <nav
          aria-label="Main"
          /* `backdrop-blur-sm` rather than `-xl`: this bar resizes on every scroll
             frame, and a wide backdrop radius must be re-rasterised each time.
             A more opaque background buys back the glassiness far cheaper. */
          className="nav-three-up grid items-center gap-2 rounded-full border border-border/80 bg-background/85 px-2.5 py-2 shadow-lg shadow-black/5 backdrop-blur-sm dark:shadow-black/30"
        >
          {/* Brand — mark only, no wordmark. */}
          <Link
            to="/"
            aria-label="Aggregator — home"
            className="flex w-fit items-center rounded-full p-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Logo className="size-8 shrink-0" />
          </Link>

          {/* Centered links — collapse into a sheet below md */}
          <div className="hidden items-center md:flex">
            {NAV_LINKS.map((link) => (
              <NavItem key={link.label} link={link} />
            ))}
          </div>

          <div className="flex justify-center md:hidden">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Open menu"
                  />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>Browse Aggregator.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-1 px-4 pb-6">
                  {NAV_LINKS.map((link) => (
                    <SheetClose
                      key={link.label}
                      nativeButton={false}
                      render={<NavItem link={link} />}
                    />
                  ))}
                  <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                    <SheetClose
                      nativeButton={false}
                      render={
                        <Button
                          variant="outline"
                          nativeButton={false}
                          render={<Link to="/login" />}
                        />
                      }
                    >
                      Sign in
                    </SheetClose>
                    <SheetClose
                      nativeButton={false}
                      render={
                        <Button
                          nativeButton={false}
                          render={<Link to="/signup" />}
                        />
                      }
                    >
                      Start free
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Actions — sign-in stays right-most on desktop */}
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              nativeButton={false}
              render={<Link to="/login" />}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link to="/signup" />}
            >
              Start free
            </Button>
          </div>
        </nav>
      </div>
    </motion.header>
  );
}
