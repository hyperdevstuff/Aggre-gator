import type { CSSProperties } from "react";

/**
 * The scatter: saved tags and links lying around the hero.
 *
 * These are drawn as single-stroke outlines rather than taken from the icon set,
 * on purpose. The hero's figure is a one-weight hairline drawing, and a filled
 * Lucide glyph dropped next to it reads as two different products. Sharing the
 * figure's idiom is what makes the page look composed instead of decorated.
 *
 * The tag carries a punched hole for the same reason the cards in `riffle` do —
 * it is the shape the product actually stores, so the marks say what the page is
 * about instead of being confetti.
 *
 * Nothing here animates. They enter once with the copy and then sit still; a
 * drifting background competes with the one thing in the hero that answers the
 * pointer. Positions are custom properties rather than Tailwind values so the
 * coordinates live in one readable table, and so nothing arbitrary ends up in a
 * className.
 */

type Mark = {
  id: string;
  glyph: "tag" | "link" | "bookmark";
  /** Centre of the mark, as a percentage of the section. */
  x: string;
  y: string;
  /** Rendered size in px, and rotation in degrees. */
  size: number;
  rotate: number;
  /** Ink weight of the stroke. */
  opacity: number;
};

/*
 * Placed to the negative space, not the content: the eyebrow and headline hold
 * the left column and the tray holds the right, so the scatter lives in the
 * margins between and around them. The first mark clears the navbar's bottom
 * edge — at 5% of the section it was clipped by it and read as a smudge.
 *
 * The whole layer is hidden below 64rem; see `.hero-scatter` in index.css for
 * why, which is why there is no per-mark "sparse" flag to second-guess here.
 */
const MARKS: Mark[] = [
  { id: "tag-a", glyph: "tag", x: "49%", y: "14%", size: 74, rotate: -14, opacity: 0.22 },
  { id: "link-a", glyph: "link", x: "93%", y: "27%", size: 88, rotate: 12, opacity: 0.17 },
  { id: "tag-b", glyph: "tag", x: "6%", y: "44%", size: 58, rotate: 18, opacity: 0.18 },
  { id: "mark-c", glyph: "bookmark", x: "42%", y: "10%", size: 48, rotate: -8, opacity: 0.13 },
  { id: "link-b", glyph: "link", x: "72%", y: "56%", size: 66, rotate: -20, opacity: 0.13 },
  { id: "tag-c", glyph: "tag", x: "97%", y: "69%", size: 78, rotate: 24, opacity: 0.16 },
  { id: "mark-d", glyph: "bookmark", x: "13%", y: "70%", size: 54, rotate: 6, opacity: 0.12 },
];

function Glyph({ glyph }: { glyph: Mark["glyph"] }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (glyph === "link") {
    return (
      <svg {...common}>
        <path d="M10.5 13.5a4 4 0 0 0 5.66 0l2.34-2.34a4 4 0 0 0-5.66-5.66l-1.2 1.2" />
        <path d="M13.5 10.5a4 4 0 0 0-5.66 0L5.5 12.84a4 4 0 0 0 5.66 5.66l1.2-1.2" />
      </svg>
    );
  }

  if (glyph === "bookmark") {
    return (
      <svg {...common}>
        <path d="M6 4.2A1.2 1.2 0 0 1 7.2 3h9.6A1.2 1.2 0 0 1 18 4.2V21l-6-4.6L6 21z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 8.6V5.6A2.6 2.6 0 0 1 5.6 3h8.9l6.5 6.5v8.9A2.6 2.6 0 0 1 18.4 21H5.6A2.6 2.6 0 0 1 3 18.4z" />
      <circle cx="7.6" cy="7.6" r="1.5" />
    </svg>
  );
}

export function HeroMarks() {
  return (
    <div aria-hidden className="hero-scatter">
      {MARKS.map((m) => (
        <span
          key={m.id}
          className="hero-mark"
          style={
            {
              "--x": m.x,
              "--y": m.y,
              "--size": `${m.size}px`,
              "--rotate": `${m.rotate}deg`,
              "--mark-opacity": m.opacity,
            } as CSSProperties
          }
        >
          <Glyph glyph={m.glyph} />
        </span>
      ))}
    </div>
  );
}