import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HairlineFigure } from "@/components/hairline/figure";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wordmark, type WordmarkVariant } from "@/components/landing/wordmark";
import { WORDMARK_OPTIONS } from "@/components/landing/wordmark-options";

export const Route = createFileRoute("/landing-prototype")({
  component: LandingPrototype,
});

/** The hero candidates built so far, all in the riffle family — one card chosen. */
const HERO = ["spread", "riffle"] as const;

function LandingPrototype() {
  const [hero, setHero] = useState<string>("spread");
  const [mark, setMark] = useState<WordmarkVariant>("reveal");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const active = WORDMARK_OPTIONS.find((option) => option.id === mark);

  return (
    <div
      data-wet-slate
      data-theme={theme}
      className="min-h-svh bg-background text-foreground"
    >
      <main className="mx-auto max-w-3xl px-6 py-24">
        <HairlineFigure name={hero} className="mx-auto w-full max-w-md" />
        <p className="meta-sm mt-6 text-center text-muted-foreground">
          hero candidate · {hero}
        </p>

        <Tabs
          value={hero}
          onValueChange={(v) => setHero(v as string)}
          className="mt-8"
        >
          <TabsList>
            {HERO.map((n) => (
              <TabsTrigger key={n} value={n}>
                {n}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* The wordmark variants, in their real footer geometry so the judgement
            is about the thing that ships rather than about a swatch. The list is
            shared with the footer lab, so the two routes cannot drift. */}
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
              max-w-3xl the 18.5vw word wraps onto two lines, which is not the
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
            render={<Link to="/prototype-footer" />}
          >
            Footer lab
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
