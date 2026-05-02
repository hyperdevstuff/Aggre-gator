import { createFileRoute } from "@tanstack/react-router";
import { usePublicShare } from "@/hooks/queries";
import { z } from "zod";
import {
  Globe,
  ExternalLink,
  Loader2,
  FolderIcon,
  BookmarkIcon,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const searchSchema = z.object({
  page: z.number().optional().default(1),
});

export const Route = createFileRoute("/share/$code")({
  validateSearch: searchSchema,
  component: PublicSharePage,
});

function PublicSharePage() {
  const { code } = Route.useParams();
  const { page } = Route.useSearch();
  const { data, isLoading, isError, error } = usePublicShare(code, {
    page,
    limit: 24,
  });

  if (isLoading) return <ShareSkeleton />;

  if (isError) {
    const status = (error as any)?.status;
    return (
      <ShareErrorPage
        title={status === 410 ? "Link Expired" : "Not Found"}
        message={
          status === 410
            ? "This shared collection is no longer available."
            : "The share link you followed doesn't exist or has been removed."
        }
      />
    );
  }

  if (!data) return <ShareErrorPage />;

  const totalBookmarks =
    data.bookmarks.pagination?.total ?? data.bookmarks.data.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <BookmarkIcon className="size-3.5" />
              </div>
              <span className="font-geist">Aggregator</span>
            </a>
          </div>
        </div>
      </header>

      {/* Collection Hero */}
      <div className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-start gap-4">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary shrink-0"
              style={{
                backgroundColor: data.collection.color
                  ? `${data.collection.color}20`
                  : undefined,
                color: data.collection.color || undefined,
              }}
            >
              {data.collection.icon ? (
                <span className="text-xl">{data.collection.icon}</span>
              ) : (
                <FolderIcon className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                {data.collection.name}
              </h1>
              {data.collection.description && (
                <p className="text-muted-foreground mt-1.5 text-sm sm:text-base max-w-2xl">
                  {data.collection.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" />
                  shared by {data.sharedBy}
                </span>
                <span>•</span>
                <span>
                  {totalBookmarks} bookmark{totalBookmarks !== 1 ? "s" : ""}
                </span>
                {data.nestedCollections.length > 0 && (
                  <>
                    <span>•</span>
                    <span>
                      {data.nestedCollections.length + 1} collection
                      {data.nestedCollections.length > 0 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nested Collections Pills */}
      {data.nestedCollections.length > 0 && (
        <div className="border-b border-border/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-muted-foreground shrink-0">
                includes:
              </span>
              {data.nestedCollections.map((nc) => (
                <Badge
                  key={nc.id}
                  variant="secondary"
                  className="shrink-0 gap-1.5"
                >
                  {nc.icon ? (
                    <span className="text-xs">{nc.icon}</span>
                  ) : (
                    <FolderIcon
                      className="h-3 w-3"
                      style={{ color: nc.color || undefined }}
                    />
                  )}
                  {nc.name}
                  <span className="text-muted-foreground">
                    ({nc.bookmarkCount})
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {data.bookmarks.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookmarkIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-sm">
              No bookmarks in this collection yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.bookmarks.data.map((bookmark) => (
              <PublicBookmarkCard key={bookmark.id} bookmark={bookmark} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data.bookmarks.pagination &&
          data.bookmarks.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              {Array.from(
                { length: data.bookmarks.pagination.totalPages },
                (_, i) => i + 1,
              ).map((p) => (
                <a
                  key={p}
                  href={`?page=${p}`}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${p === page
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Shared via{" "}
              <a
                href="/"
                className="text-foreground font-medium hover:underline"
              >
                Aggregator
              </a>
            </span>
            <a
              href="/"
              className="text-foreground font-medium hover:underline"
            >
              Start collecting →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Sub Components ---

function PublicBookmarkCard({ bookmark }: { bookmark: any }) {
  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border/60 bg-card overflow-hidden hover:shadow-lg hover:border-border transition-all duration-200"
    >
      {/* Cover Image */}
      {bookmark.cover && (
        <div className="relative aspect-video overflow-hidden bg-muted">
          <img
            src={bookmark.cover}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {bookmark.title || bookmark.url}
          </h3>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
        </div>

        {bookmark.description && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
            {bookmark.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-3">
          {/* Favicon */}
          {bookmark.domain && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <img
                src={`https://www.google.com/s2/favicons?domain=${bookmark.domain}&sz=16`}
                alt=""
                className="w-3.5 h-3.5 rounded-sm"
                loading="lazy"
              />
              <span className="truncate max-w-[140px]">
                {bookmark.domain}
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        {bookmark.tags && bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {bookmark.tags.map(
              (tag: { id: string; name: string; color: string | null }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground"
                  style={{
                    backgroundColor: tag.color
                      ? `${tag.color}20`
                      : undefined,
                    color: tag.color || undefined,
                  }}
                >
                  {tag.name}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </a>
  );
}

function ShareSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading collection...</p>
      </div>
    </div>
  );
}

function ShareErrorPage({
  title = "Not Found",
  message = "This share link doesn't exist or has been removed.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <a
          href="/"
          className="text-sm text-primary hover:underline mt-2"
        >
          ← Go to Aggregator
        </a>
      </div>
    </div>
  );
}
