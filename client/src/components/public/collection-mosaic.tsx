import { cn } from "@/lib/utils";

type CollectionMosaicProps = {
  /** Up to 4 cover image URLs from the collection's subtree. */
  covers: string[];
  className?: string;
};

/**
 * A 0–4 image mosaic used as a collection card's cover on the public surfaces.
 *
 * Renders nothing when the collection has no images, so a text-only card stays
 * compact (and masonry gets genuine height variety). Images are hotlinked from
 * the bookmark's own site — the same as every cover in the app — so a tile that
 * fails to load simply drops out rather than showing a broken-image glyph.
 */
export function CollectionMosaic({ covers, className }: CollectionMosaicProps) {
  const tiles = covers.filter(Boolean).slice(0, 4);
  if (tiles.length === 0) return null;

  const layout =
    tiles.length === 1
      ? "grid-cols-1"
      : tiles.length === 2
        ? "grid-cols-2 grid-rows-1"
        : "grid-cols-2 grid-rows-2";

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden border-b border-border/60 bg-muted",
        className,
      )}
      aria-hidden="true"
    >
      <div className={cn("grid size-full gap-px", layout)}>
        {tiles.map((src, index) => (
          <div
            key={`${src}-${index}`}
            className={cn(
              "overflow-hidden bg-muted",
              tiles.length === 3 && index === 0 && "row-span-2",
            )}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              className="size-full object-cover"
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
