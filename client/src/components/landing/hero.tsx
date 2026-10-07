import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharePagePreview } from "@/components/landing/share-page-preview";
import { HeroMarks } from "@/components/landing/hero-marks";
import { HairlineFigure } from "@/components/hairline/figure";

const RISE = {
  hidden: { y: 14, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

export function Hero() {
  const reduceMotion = useReducedMotion();
  const transition = { duration: 0.6, ease: [0.23, 1, 0.32, 1] as const };

  return (
    <section className="relative overflow-hidden">
      {/* Backdrop layers, both absolutely positioned and both ahead of the content
          in the DOM — the content is `relative`, so it paints over them. Nothing
          here takes a negative z-index: the section makes no stacking context, so
          one would put these behind the page's own background. */}
      <div
        aria-hidden
        className="landing-grid pointer-events-none absolute inset-0"
      />
      <HeroMarks />

      {/*
        Asymmetric: the claim takes the left column and the tray the right, rather
        than both stacking on one centre line. A centred hero is the shape every
        landing page settles into, and it gives the eye nowhere to enter — here the
        left edge is a hard vertical the copy hangs off, and the figure sits past
        it. Below 1024 the two stack and the copy re-centres, because a centred
        headline over a full-width button column is the correct shape at that
        width and splitting it would only make both halves worse.
      */}
      <div className="relative mx-auto max-w-6xl px-6 pt-32 sm:pt-36 lg:pt-44">
        <div className="hero-split grid items-center gap-y-14 lg:gap-x-14">
          <div className="text-center lg:text-left">
            <motion.div
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              variants={RISE}
              transition={transition}
            >
              <span className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                <Globe className="size-3.5" />
                Curate links from the web.
              </span>
            </motion.div>

            <motion.h1
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              variants={RISE}
              transition={{ ...transition, delay: 0.06 }}
              className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
            >
              Everyone can send a link.
              <br />A list is what goes stale.
            </motion.h1>

            <motion.p
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              variants={RISE}
              transition={{ ...transition, delay: 0.12 }}
              className="mx-auto mt-5 max-w-xl text-base text-pretty text-muted-foreground lg:mx-0 lg:text-lg"
            >
              Aggregator turns a collection you are already keeping into a public page
              that stays current. Add to it later and everyone who already has
              the link sees the change, so you send it once.
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              variants={RISE}
              transition={{ ...transition, delay: 0.18 }}
              className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row lg:justify-start"
            >
              <Button
                size="lg"
                nativeButton={false}
                render={<Link to="/signup" />}
              >
                Start free
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link to="/explore" />}
              >
                See an example
              </Button>
            </motion.div>

            <motion.p
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              variants={RISE}
              transition={{ ...transition, delay: 0.24 }}
              className="mt-4 text-xs text-muted-foreground"
            >
              Free tier, no card.
            </motion.p>
          </div>

          {/* The tray. Larger than it was when it sat under the copy, because it
              now has a column of its own rather than sharing the centre line. */}
          <motion.div
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            variants={RISE}
            transition={{ ...transition, delay: 0.3 }}
            className="mx-auto w-full max-w-lg lg:max-w-none"
          >
            <HairlineFigure name="riffle" />
          </motion.div>
        </div>
      </div>

      {/* The artifact itself, below the claim: the collection as its readers get it.
          Its left edge lands on the same axis as the headline, so the page has one
          vertical to read down rather than two competing centres. */}
      <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:pb-32 lg:mt-14">
        <SharePagePreview />
      </div>
    </section>
  );
}
