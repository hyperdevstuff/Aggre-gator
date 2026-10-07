import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteFooter } from "@/components/landing/site-footer";
import { FooterBefore } from "@/components/landing/footer-before";

export const Route = createFileRoute("/prototype-footer")({
  component: FooterLab,
});

/**
 * The options are the shipped footer and two readings of it, not new structures.
 * Each entry holds a built element rather than a component, so the file stays a
 * route and not a component library.
 */
const OPTIONS: { id: string; label: string; note: string; element: ReactNode }[] = [
  {
    id: "shipped",
    label: "Shipped",
    note: "The footer as it ships now: notes on, the mark at 40px as the lockup's anchor, the duplicate Explore link and the meaningless sign-off gone, and the too-many-tabs line with the utility row to itself.",
    element: <SiteFooter />,
  },
  {
    id: "lean",
    label: "Lean",
    note: "The same footer with the link descriptions switched off. Tighter, and closer to how it looked before.",
    element: <SiteFooter notes={false} />,
  },
  {
    id: "before",
    label: "Before",
    note: "The footer as it shipped before this pass, frozen for comparison.",
    element: <FooterBefore />,
  },
];

function FooterLab() {
  const [option, setOption] = useState<string>("shipped");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const active = OPTIONS.find((item) => item.id === option);

  return (
    <div
      id="top"
      data-wet-slate
      data-theme={theme}
      className="min-h-svh bg-background text-foreground"
    >
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-14">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/landing-prototype" />}
          >
            back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "light" : "dark"} theme
          </Button>
        </div>

        <section className="mt-14">
          <h1 className="text-2xl font-semibold tracking-tight">Footer lab</h1>
          <p className="mt-2 max-w-2xl text-sm text-pretty text-muted-foreground">
            The footer, improvised in place. Same shape as the one that ships, with
            the rough edges taken off. The big wordmark sits at the foot of each and
            is not part of the judgement.
          </p>
        </section>
      </div>

      {/* `flex-col` is set explicitly: the shell's own `data-horizontal:flex-col`
          never matches here (Base UI writes `data-orientation`, not
          `data-horizontal`), so without it the header and every panel lay out in a
          row and shrink to their content. */}
      <Tabs
        value={option}
        onValueChange={(value) => setOption(value as string)}
        className="flex-col"
      >
        <div className="mx-auto max-w-6xl px-6">
          <TabsList>
            {OPTIONS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <p className="mt-4 min-h-16 max-w-2xl text-sm text-pretty text-muted-foreground">
            {active?.note}
          </p>
        </div>

        {OPTIONS.map(({ id, element }) => (
          <TabsContent key={id} value={id}>
            {element}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
