import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
//import { BookmarkCard } from "@/components/bookmark-card";
import type { Bookmark } from "@/types";

type BookmarksGridProps = {
  bookmarks?: Bookmark[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  onCreateFirst?: () => void;
  onEditBookmark?: (bookmark: Bookmark) => void;
};

export function BookmarksGrid({
  bookmarks,
  isLoading,
  error,
  onRetry,
  onCreateFirst,
  //onEditBookmark,
}: BookmarksGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-2">failed to load bookmarks</p>
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            retry
          </Button>
        )}
      </div>
    );
  }

  if (!bookmarks || bookmarks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">no bookmarks found</p>
        {onCreateFirst && (
          <Button onClick={onCreateFirst}>create your first bookmark</Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/*{bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          onEdit={onEditBookmark}
        />
      ))}*/}
    </div>
  );
}
