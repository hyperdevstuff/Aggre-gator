import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HairlineFigure } from "@/components/hairline/figure";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wordmark, type WordmarkVariant } from "@/components/landing/wordmark";
import { WORDMARK_OPTIONS } from "@/components/landing/wordmark-options";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/landing-prototype")({
  component: LandingPrototype,
});

/**
 * Every figure that exists, with the gesture it makes. This is a review board,
 * not a switcher: the point is to see them side by side and decide which are
 * worth keeping, so all of them mount at once rather than one tab at a time.
 *
 * `riffle` is the chosen hero. The others are here so the decision to *remove*
 * them is made with the whole set in view, not from memory.
 *
 * `means` mirrors each figure's own description in its source, so the caption
 * and the geometry cannot drift apart.
 */
const FIGURES = [
  {
    name: "riffle",
    object: "Eight cards fanned in a tray",
    gesture: "The card under the pointer stands up.",
    role: "Hero — chosen",
    keep: true,
  },
  {
    name: "spread",
    object: "A hand of cards laid flat and open",
    gesture: "The hand opens along its length.",
    role: "Hero — the candidate riffle replaces",
    keep: false,
  },
  {
    name: "press",
    object: "A stamping press",
    gesture: "Pointer height drives the stamp down; a card rises out of the slot.",
    role: "'How it works' step 1 — a URL becomes a card",
    keep: true,
  },
  {
    name: "pigeonholes",
    object: "A sorting wall, nine pockets in three rows",
    gesture: "One card slides clear; its row steps forward.",
    role: "'How it works' step 2 — filed by depth. The three rows are the 3-level nesting cap",
    keep: true,
  },
  {
    name: "sheaf",
    object: "A shelf of three banded bundles",
    gesture: "The chosen one lifts clear; others lean back.",
    role: "'How it works' step 3 — the collection, published whole",
    keep: true,
  },
  {
    name: "rack",
    object: "Nine pegs on a board",
    gesture: "Nearest peg holds its card up; others tip toward it.",
    role: "Retired — superseded by pigeonholes, which states the same idea with the depth cap in the geometry",
    keep: false,
  },
] as const;

function LandingPrototype() {
  const [mark, setMark] = useState<WordmarkVariant>("reveal");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const active = WORDMARK_OPTIONS.find((option) => option.id === mark);

  return (
    <div
      data-wet-slate
      data-theme={theme}
      className="min-h-svh bg-background text-foreground"
    >
      <main className="mx-auto max-w-5xl px-6 py-16">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hairline figures
          </h1>
          <p className="meta-sm mt-2 text-muted-foreground">
            every figure · live, not a screenshot
          </p>
        </header>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FIGURES.map((figure) => (
            <figure
              key={figure.name}
              className={cn(
                "flex flex-col rounded-xl border p-5",
                figure.keep
                  ? "border-border/70 bg-card"
                  : "border-dashed border-border/60 bg-card/40",
              )}
            >
              <HairlineFigure
                name={figure.name}
                intensity={0.5}
                className="w-full"
              />

              <figcaption className="mt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-medium">{figure.name}</h2>
                  <span
                    className={cn(
                      "meta-sm shrink-0",
                      figure.keep ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {figure.keep ? "keep" : "retire"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-pretty text-muted-foreground">
                  {figure.object} — {figure.gesture}
                </p>
                <p className="mt-2 text-xs text-pretty text-muted-foreground/70">
                  {figure.role}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-8 max-w-prose text-xs text-pretty text-muted-foreground">
          Hover a figure to drive it. Solid border is kept, dashed is a retire
          candidate. Removing one means deleting{" "}
          <code className="font-mono">client/public/&lt;name&gt;.js</code> and
          its preview assets, then dropping the entry here — the figures share
          one kernel, so nothing else needs touching.
        </p>

        {/* The wordmark variants, in their real footer geometry so the judgement
            is about the thing that ships rather than about a swatch. The list is
            shared with the footer, so the two cannot drift. */}
        <section className="mt-24 border-t border-border/60 pt-10">
          <h2 className="meta-sm text-muted-foreground">wordmark</h2>
          <p className="mt-3 min-h-16 max-w-xl text-sm text-pretty text-muted-foreground">
            {active?.note}
          </p>
          <Tabs
            value={mark}
            onValueChange={(v) => setMark(v as WordmarkVariant)}
            className="mt-6"
          >
            <TabsList>
              {WORDMARK_OPTIONS.map((option) => (
                <TabsTrigger key={option.id} value={option.id}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {/* Full-bleed, exactly as the footer renders it. Inside this page's
              max-w-5xl the 18.5vw word wraps onto two lines, which is not the
              thing being judged. */}
          <div className="relative left-1/2 mt-8 w-screen -translate-x-1/2">
            <Wordmark variant={mark} />
          </div>
        </section>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/" />}
          >
            Back to landing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "light" : "dark"} theme
          </Button>
        </div>
      </main>
    </div>
  );
}