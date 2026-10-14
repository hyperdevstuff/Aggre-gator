import type { CSSProperties, ReactNode } from "react";
import type { PublicBookmark } from "@/types";
import { cn } from "@/lib/utils";
import {
  Globe,
  ExternalLink,
  Loader2,
  FolderIcon,
  BookmarkIcon,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";

/**
 * The one rendering of a published collection.
 *
 * `/share/:code` (the unlisted URL) and `/u/:username/:slug` (the readable one)
 * return the same payload shape from the API precisely so this component can
 * serve both. Two copies would drift, and a shared collection that renders
 * differently depending on which URL you followed is a bug users notice.
 */

export type PublicCollectionViewProps = {
  collection: {
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
  };
  /** "shared by …" line. */
  sharedByLabel: string;
  bookmarks: {
    data: PublicBookmark[];
    pagination?: {
      page: number;
      totalPages: number;
      total: number;
    } | null;
  };
  nestedCollections: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    /**
     * Present on `/u/:username/:slug`, absent from `/share/:code`. Optional
     * rather than nullable because the two endpoints genuinely differ here —
     * the share payload predates slugs on nested collections.
     */
    slug?: string | null;
    bookmarkCount: number;
  }>;
  /** Builds a link for a nested collection, or null when it has no URL. */
  nestedHref?: (nested: { id: string; slug?: string | null }) => string | null;
  /** Current page, for the pager. */
  page: number;
  /** Builds a URL for another page — lets the caller use router navigation. */
  buildPageHref: (page: number) => string;
};

export function PublicCollectionView({
  collection,
  sharedByLabel,
  bookmarks,
  nestedCollections,
  nestedHref,
  page,
  buildPageHref,
}: PublicCollectionViewProps) {
  const total = bookmarks.pagination?.total ?? bookmarks.data.length;
  const totalPages = bookmarks.pagination?.totalPages ?? 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Logo className="size-3.5" />
            </div>
            <span className="font-geist">Aggregator</span>
          </a>
        </div>
      </header>

      <div className="border-b border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-xl",
                collection.color
                  ? "bg-(--tint-bg) text-(--tint-fg)"
                  : "bg-primary/10 text-primary",
              )}
              style={
                {
                  "--tint-bg": collection.color
                    ? `${collection.color}20`
                    : undefined,
                  "--tint-fg": collection.color || undefined,
                } as CSSProperties
              }
            >
              {collection.icon ? (
                <span className="text-xl">{collection.icon}</span>
              ) : (
                <FolderIcon className="size-6" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {collection.name}
              </h1>
              {collection.description && (
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {collection.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Globe className="size-3.5" aria-hidden="true" />
                  {sharedByLabel}
                </span>
                <span aria-hidden="true">•</span>
                <span>
                  {total} bookmark{total === 1 ? "" : "s"}
                </span>
                {nestedCollections.length > 0 && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>
                      {nestedCollections.length + 1} collection
                      {nestedCollections.length > 0 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {nestedCollections.length > 0 && (
        <div className="border-b border-border/50">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 text-xs text-muted-foreground">
                includes:
              </span>
              {nestedCollections.map((nested) => {
                const href = nestedHref?.(nested) ?? null;
                const body = (
                  <>
                    {nested.icon ? (
                      <span className="text-xs">{nested.icon}</span>
                    ) : (
                      <FolderIcon
                        className="size-3 text-(--nc)"
                        style={
                          { "--nc": nested.color || "currentColor" } as CSSProperties
                        }
                      />
                    )}
                    {nested.name}
                    <span className="text-muted-foreground">
                      ({nested.bookmarkCount})
                    </span>
                  </>
                );
                // The <a> owns the hover treatment; the Badge keeps its own
                // spacing and colour, which the shadcn lint enforces.
                return href ? (
                  <a
                    key={nested.id}
                    href={href}
                    className="shrink-0 rounded-full underline-offset-4 hover:underline"
                  >
                    <Badge variant="secondary">{body}</Badge>
                  </a>
                ) : (
                  <Badge key={nested.id} variant="secondary" className="shrink-0">
                    {body}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {bookmarks.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookmarkIcon className="mb-4 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No bookmarks in this collection yet.
            </p>
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {bookmarks.data.map((bookmark) => (
              <PublicBookmarkCard key={bookmark.id} bookmark={bookmark} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            aria-label="Pagination"
            className="mt-10 flex items-center justify-center gap-2"
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={buildPageHref(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                {p}
              </a>
            ))}
          </nav>
        )}
      </main>

      <footer className="mt-12 border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Shared via{" "}
              <a href="/" className="font-medium text-foreground hover:underline">
                Aggregator
              </a>
            </span>
            <a
              href="/"
              className="font-medium text-foreground hover:underline"
            >
              Start collecting →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PublicBookmarkCard({ bookmark }: { bookmark: PublicBookmark }) {
  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group mb-4 block break-inside-avoid overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-200 hover:border-border hover:shadow-lg"
    >
      {bookmark.cover && (
        <div className="relative aspect-video overflow-hidden bg-muted">
          <img
            src={bookmark.cover}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
            {bookmark.title || bookmark.url}
          </h3>
          <ExternalLink
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </div>

        {bookmark.description && (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
            {bookmark.description}
          </p>
        )}

        {bookmark.domain && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <img
              src={`https://www.google.com/s2/favicons?domain=${bookmark.domain}&sz=16`}
              alt=""
              className="size-3.5 rounded-sm"
              loading="lazy"
            />
            <span className="max-w-35 truncate">{bookmark.domain}</span>
          </div>
        )}

        {bookmark.tags && bookmark.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {bookmark.tags.map((tag) => (
              <span
                key={tag.id}
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                  tag.color
                    ? "bg-(--tag-bg) text-(--tag-fg)"
                    : "bg-secondary text-secondary-foreground",
                )}
                style={
                  {
                    "--tag-bg": tag.color ? `${tag.color}20` : undefined,
                    "--tag-fg": tag.color || undefined,
                  } as CSSProperties
                }
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

export function PublicPageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}…</p>
      </div>
    </div>
  );
}

export function PublicErrorPage({
  title = "Not Found",
  message = "This page doesn't exist or has been removed.",
  children,
}: {
  title?: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        {children ?? (
          <a href="/" className="mt-2 text-sm text-primary hover:underline">
            ← Go to Aggregator
          </a>
        )}
      </div>
    </div>
  );
}