import { Link } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LEGAL } from "@/lib/legal";

type Tier = {
  name: string;
  price: string;
  cadence?: string;
  /** What this tier is for. One line, no adjectives. */
  summary: string;
  features: string[];
  /** Named exclusions — saying what is *not* included is what makes it credible. */
  lacks?: string;
  cta: { label: string; to: string; variant?: "default" | "outline" };
  highlighted?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    summary:
      "Enough for one person keeping one set of links straight. The limit is how many pages you publish, not how much you keep.",
    features: [
      "Unlimited bookmarks and collections",
      "Unlimited private collections",
      "Nesting three levels deep",
      "Tags, favorites, archive, search",
      `${LEGAL.freePublicCollections} published collections`,
      "Unlimited viewers",
    ],
    lacks: "Password protection and view analytics",
    cta: { label: "Start free", to: "/signup", variant: "outline" },
  },
  {
    name: "Pro",
    price: LEGAL.proPrice,
    cadence: "/month",
    summary:
      "For the collection other people actually come back to. You are past whether to publish and into who is reading.",
    features: [
      "Everything in Free",
      "Unlimited published collections",
      "View counts, referrers, top bookmarks",
      "Passwords, expiry dates, custom slugs",
      "Multi-collection pages",
      "Custom title, logo and color",
    ],
    cta: { label: "Get Pro", to: "/signup", variant: "default" },
    highlighted: true,
  },
];

export function PricingTeaser() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-28 border-t border-border/60"
    >
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2
            id="pricing-heading"
            className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            Free isn&apos;t a trial
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            No card, no countdown, no feature gate. The paid plan removes the
            publishing limit and adds the numbers: views, referrers, and which
            links people open.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:max-w-4xl">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-6",
                tier.highlighted && "shadow-sm ring-1 ring-foreground/15",
              )}
            >
              <h3 className="text-sm font-medium">{tier.name}</h3>

              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">
                  {tier.price}
                </span>
                {tier.cadence && (
                  <span className="text-sm text-muted-foreground">
                    {tier.cadence}
                  </span>
                )}
              </p>

              <p className="mt-3 text-sm text-pretty text-muted-foreground">
                {tier.summary}
              </p>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm"
                  >
                    <Check
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    {feature}
                  </li>
                ))}
                {tier.lacks && (
                  <li className="flex items-start gap-2.5 text-sm text-muted-foreground/70">
                    <Minus
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0"
                    />
                    {tier.lacks}
                  </li>
                )}
              </ul>

              <div className="mt-6">
                <Button
                  variant={tier.cta.variant ?? "outline"}
                  className="w-full"
                  nativeButton={false}
                  render={<Link to={tier.cta.to} />}
                >
                  {tier.cta.label}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-border/60 pt-6">
          <p className="meta-sm">No card on Free</p>
          <p className="max-w-xl text-xs text-muted-foreground">
            Free includes unlimited private collections and{" "}
            {LEGAL.freePublicCollections} published ones. Pro removes the
            publishing limit and adds analytics and share controls. Billed
            monthly in USD, cancel any time; see the{" "}
            <Link
              to="/refunds"
              className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              refund policy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}