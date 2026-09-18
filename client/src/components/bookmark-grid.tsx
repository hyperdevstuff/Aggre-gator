import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkCard } from "@/components/bookmark-card";
import { motion } from "motion/react";
import type { Bookmark } from "@/types";

type BookmarksGridProps = {
  bookmarks?: Bookmark[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  onCreateFirst?: () => void;
  onEditBookmark?: (bookmark: Bookmark) => void;
  onEditTag?: (tag: Bookmark["tags"][number]) => void;
  archivedCollectionId?: string;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
};

export function BookmarksGrid({
  bookmarks,
  isLoading,
  error,
  onRetry,
  onCreateFirst,
  onEditBookmark,
  onEditTag,
  archivedCollectionId,
  selectedIds,
  onToggleSelect,
}: BookmarksGridProps) {
  if (isLoading) {
    return (
      <motion.div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Skeleton className="h-64 rounded-xl" />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-2">Failed to load bookmarks</p>
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (!bookmarks || bookmarks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No bookmarks found</p>
        {onCreateFirst && (
          <Button onClick={onCreateFirst}>Create your first bookmark</Button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
      initial="hidden"
      animate="show"
    >
      {bookmarks.map((bookmark) => (
        <motion.div
          key={bookmark.id}
          variants={{
            hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
            show: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 25,
              },
            },
          }}
        >
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            onEdit={onEditBookmark}
            onEditTag={onEditTag}
            isArchived={
              archivedCollectionId !== undefined &&
              bookmark.collectionId === archivedCollectionId
            }
            selected={selectedIds?.includes(bookmark.id) ?? false}
            onToggleSelect={onToggleSelect}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
