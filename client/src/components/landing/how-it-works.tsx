import { cn } from "@/lib/utils";

/*
 * The three moves, in order, and every line is checkable against the app.
 * "Public profiles" is the one thing here that does not exist yet, so it is
 * marked as next rather than written as a feature — the landing does not claim
 * what the product cannot do.
 */
const STEPS = [
  {
    number: "01",
    title: "Save a link",
    body: "Paste any URL and Aggregator fetches the title, description, cover and favicon for you, so nothing lands as an untitled dump.",
  },
  {
    number: "02",
    title: "File it in a collection",
    body: "Sort bookmarks into collections that nest three levels deep, so a syllabus or a shortlist keeps its shape instead of flattening into a list.",
  },
  {
    number: "03",
    title: "Share the page",
    body: "One link opens the collection and its sub-collections to readers with no account, and adding a bookmark later reaches everyone already holding it.",
    next: "Public profiles, where everything you publish sits under one name",
  },
];

/**
 * How it works — three beats, alternating an explanation with its figure slot.
 * The figure is a hairline piece that has not been built yet, so the slot is left
 * empty on purpose; it carries the same rounded card surface the real figure will
 * sit on, and nothing else.
 *
 * The alternation is a `lg:order` flip rather than a second markup branch, so the
 * reading order stays 01, 02, 03 for a screen reader and for the stacked mobile
 * layout — only the large-viewport placement changes.
 */
export function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="scroll-mt-28 border-t border-border/60"
    >
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2
            id="how-heading"
            className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            How it works
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Three moves from a link you saved to a page you can send, and each one
            keeps what you already made.
          </p>
        </div>

        <div className="mt-16 flex flex-col gap-16 sm:gap-24">
          {STEPS.map((step, i) => {
            const flipped = i % 2 === 1;

            return (
              <div
                key={step.number}
                className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
              >
                <div className={cn(flipped && "lg:order-2")}>
                  <p className="meta-sm">{step.number}</p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-md text-pretty text-muted-foreground">
                    {step.body}
                  </p>
                  {step.next && (
                    <p className="meta-sm mt-3">Next · {step.next}</p>
                  )}
                </div>

                {/* Empty on purpose — the figure goes here. */}
                <div
                  aria-hidden
                  className={cn(
                    "aspect-video rounded-xl border border-border/60 bg-card",
                    flipped && "lg:order-1",
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
