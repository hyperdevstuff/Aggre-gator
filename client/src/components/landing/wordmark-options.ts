import type { WordmarkVariant } from "@/components/landing/wordmark";

/**
 * The wordmark variants with the note each one is judged by, kept out of
 * `wordmark.tsx` so that file exports only its component. Order is the order the
 * labs list them: the one that ships first, then the gestures, then the quieter
 * ones.
 */
export const WORDMARK_OPTIONS: {
  id: WordmarkVariant;
  label: string;
  note: string;
}[] = [
  {
    id: "plain",
    label: "plain",
    note: "One tone, whole letters. The safe default — what ships while a split is still being chosen.",
  },
  {
    id: "reveal",
    label: "reveal",
    note: "A straight horizontal cut. At rest each letter shows its top half; hover opens the clip and the word resolves whole, staggered 26ms per letter.",
  },
  {
    id: "wipe",
    label: "wipe",
    note: "Arrives as a hairline outline and fills left to right behind the stroke — a page filling as you add to it. On touch, where there is no hover, it renders filled.",
  },
  {
    id: "wave",
    label: "wave",
    note: "The seam rides a sine across the letters, so the cut undulates. Hover straightens it to one clean line — quieter than revealing, and the word stays half-cut either way.",
  },
  {
    id: "track",
    label: "track",
    note: "The seam follows the pointer's height: travel down the word and it fills, travel up and it empties. Reads as a scrub rather than a click.",
  },
  {
    id: "riffle",
    label: "riffle",
    note: "The word sits as a hand of cards, each letter tipped off the baseline. The pointer stands one up — the same gesture the hero's riffle figure makes.",
  },
  {
    id: "focus",
    label: "focus",
    note: "Every letter knocked back to a ghost tone; the pointer brings one to full ink and the rest recede. Retrieval rather than reveal.",
  },
];
