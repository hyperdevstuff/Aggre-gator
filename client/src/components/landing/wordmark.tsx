import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * The closing wordmark.
 *
 * One element per letter, one tone, and a gesture that opens the word: `reveal`
 * shows each letter's top half and fills in the rest on hover; `wave` rides the
 * seam on a sine and straightens it; `track` hands the seam to the pointer;
 * `wipe` arrives as a hairline outline and fills left to right; `riffle` fans the
 * letters like cards and stands one up; `focus` ghosts the word and lights the
 * letter under the pointer.
 *
 * Earlier versions drew each letter twice — once in ink, once in a second tone —
 * and clipped both to their own halves. With a single tone there is nothing to
 * blend, so the second layer only introduced a hairline that traced the whole
 * shape at small sizes, where one glyph's antialiased edge landed on the other's.
 * The second copy is gone, and `wipe` gets outline-and-fill from one element by
 * stroking the glyph and clipping an ink background to its own text.
 *
 * The hover is CSS and the entrance is motion, on purpose. The hover has to be
 * interruptible — a pointer leaving mid-open should reverse from where it is — and
 * a transition retargets for free where an animation restarts from zero. The
 * entrance is the opposite: scroll-linked, once, so it wants `whileInView`.
 *
 * The glyph is a nested span because Motion writes its entrance as an inline
 * `transform` on the letter, and an inline style beats a stylesheet rule. The
 * transform-based variants therefore move the glyph, which Motion never touches.
 *
 * Splitting text into spans costs the kerning pairs the font would apply across
 * letter boundaries ("Ag", "gr"). At this size with tracking already at -0.05em the
 * loss is invisible, which is why it isn't worth measuring — but it is the reason
 * not to reach for this on body copy.
 */

const WORD = "Aggregator";

export type WordmarkVariant =
  | "plain"
  | "reveal"
  | "wave"
  | "track"
  | "wipe"
  | "riffle"
  | "focus";

export function Wordmark({ variant = "plain" }: { variant?: WordmarkVariant }) {
  const reduceMotion = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const middle = (WORD.length - 1) / 2;

  /**
   * `track` reads the pointer's height and moves the seam with it, so the word
   * fills and empties as the pointer travels vertically. Written straight to the
   * node as a custom property rather than through state — a re-render per pointer
   * move would put React in the path of a value that changes every frame.
   */
  const track = (e: React.PointerEvent) => {
    const el = host.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--seam", `${Math.min(100, Math.max(0, pct))}%`);
  };

  return (
    <div
      ref={host}
      className="overflow-hidden"
      onPointerMove={variant === "track" ? track : undefined}
      onPointerLeave={
        variant === "track"
          ? () => host.current?.style.setProperty("--seam", "50%")
          : undefined
      }
    >
      <p aria-hidden className="wordmark select-none px-6" data-variant={variant}>
        {WORD.split("").map((char, i) => (
          <motion.span
            key={`${char}-${i}`}
            className="wordmark-letter"
            initial={reduceMotion ? false : { opacity: 0, y: "0.18em" }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.6,
              ease: [0.23, 1, 0.32, 1],
              delay: i * 0.035,
            }}
            style={
              {
                "--split-delay": `${i * 26}ms`,
                // A half-period sine, so the seam rises and falls across the word
                // instead of climbing monotonically — a straight ramp reads as a
                // mistake rather than a wave.
                "--wave": `${Math.sin((i / (WORD.length - 1)) * Math.PI * 2) * 7}%`,
                // The riffle fan: letters tip away from the middle, so the word
                // opens like a hand of cards rather than leaning as one block.
                "--tilt": `${(i - middle) * 1.05}deg`,
              } as React.CSSProperties
            }
          >
            <span className="wordmark-glyph">{char}</span>
          </motion.span>
        ))}
      </p>
      <span className="sr-only">Aggregator</span>
    </div>
  );
}
