import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/* All three are true today. "Cancel any time" used to sit here and was not: there
   is nothing to cancel while Pro and Team are unbuilt, so it was asking the
   reader to trust a promise about a product that does not exist. */
const ASSURANCES = ["No card", "5 public links included", "Unlimited readers"];

/**
 * The close. One claim, one action, and the three things people actually ask
 * before signing up — stated as machine facts rather than reassurance prose.
 */
export function CloseCta() {
  return (
    <section
      aria-labelledby="close-heading"
      className="border-t border-border/60"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-20 sm:py-28 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
        <div className="max-w-2xl">
          <h2
            id="close-heading"
            className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            Start with one collection. Stop re-sending it.
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
            One collection, one public page. It costs nothing to keep running,
            and the link you send someone stays current without you touching it
            again.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <div className="flex flex-wrap gap-2.5">
            <Button
              nativeButton={false}
              render={<Link to="/signup" />}
            >
              Start free
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/explore" />}
            >
              See an example
            </Button>
          </div>
          <p className="meta-sm lg:text-right">
            {ASSURANCES.join(" · ")}
          </p>
        </div>
      </div>
    </section>
  );
}