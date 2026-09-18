import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ExternalLink,
  Star,
  MoreVertical,
  Trash2,
  Loader2,
  Edit,
  Archive,
  ArchiveRestore,
  Link2,
  Tag as TagIcon,
} from "lucide-react";
import { motion } from "motion/react";
import {
  useUpdateBookmark,
  useDeleteBookmark,
  useBulkArchiveBookmarks,
  useBulkUnarchiveBookmarks,
} from "@/hooks/use-mutations";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useState } from "react";
import type { Bookmark } from "@/types";

type BookmarkCardProps = {
  bookmark: Bookmark;
  onEdit?: (bookmark: Bookmark) => void;
  /** When set, tag chips render as buttons that open the tag editor. */
  onEditTag?: (tag: Bookmark["tags"][number]) => void;
  /** Whether the bookmark lives in the Archived collection. */
  isArchived?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
};

export function BookmarkCard({
  bookmark,
  onEdit,
  onEditTag,
  isArchived,
  selected,
  onToggleSelect,
}: BookmarkCardProps) {
  const updateBookmark = useUpdateBookmark();
  const deleteBookmark = useDeleteBookmark();
  const archiveBookmarks = useBulkArchiveBookmarks();
  const unarchiveBookmarks = useBulkUnarchiveBookmarks();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const toggleFavorite = () => {
    updateBookmark.mutate({
      id: bookmark.id,
      data: { isFavorite: !bookmark.isFavorite },
    });
  };

  const archivePending = archiveBookmarks.isPending || unarchiveBookmarks.isPending;

  const handleArchive = () => {
    if (isArchived) {
      unarchiveBookmarks.mutate([bookmark.id]);
    } else {
      archiveBookmarks.mutate([bookmark.id]);
    }
  };

  const handleDelete = () => {
    deleteBookmark.mutate(bookmark.id);
  };

  return (
    <motion.article
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Cover Image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {bookmark.cover ? (
          <>
            <img
              src={bookmark.cover}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent"
            />
          </>
        ) : (
          <div
            aria-hidden="true"
            className="flex aspect-[16/10] w-full items-center justify-center bg-muted"
          >
            <Link2 className="size-8 text-muted-foreground/50" />
          </div>
        )}

        {/* Floating actions on hover (Raindrop pattern) */}
        <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background/90"
            onClick={toggleFavorite}
            aria-label={
              bookmark.isFavorite
                ? "Remove from favorites"
                : "Add to favorites"
            }
            aria-pressed={bookmark.isFavorite}
            disabled={updateBookmark.isPending}
          >
            {updateBookmark.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Star
                className={`size-4 ${bookmark.isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`}
              />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background/90"
                  aria-label={`Actions for ${bookmark.title}`}
                  data-bookmark-menu={bookmark.id}
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="flex items-center"
                render={
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink className="size-4" />
                Open
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(bookmark)}>
                  <Edit className="size-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleArchive}
                disabled={archivePending}
              >
                {isArchived ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
                {archivePending
                  ? isArchived
                    ? "Restoring…"
                    : "Archiving…"
                  : isArchived
                    ? "Restore"
                    : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={deleteBookmark.isPending}
              >
                <Trash2 className="size-4" />
                {deleteBookmark.isPending ? "Deleting…" : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Checkbox for bulk select */}
        {onToggleSelect && (
          <div className="absolute left-2 top-2 rounded-md bg-background/90 p-1 shadow-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Checkbox
              checked={selected ?? false}
              onCheckedChange={() => onToggleSelect(bookmark.id)}
              aria-label={`Select ${bookmark.title}`}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 font-semibold leading-tight text-card-foreground hover:underline"
        >
          {bookmark.title}
        </a>

        <p className="truncate text-xs text-muted-foreground">
          {bookmark.url}
        </p>

        {bookmark.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-2" aria-label="Tags">
            {bookmark.tags.slice(0, 3).map((tag) =>
              onEditTag ? (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onEditTag(tag)}
                  aria-label={`Edit tag ${tag.name}`}
                  title={`Edit tag ${tag.name}`}
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-full text-xs font-normal hover:bg-muted"
                  >
                    <TagIcon className="size-3" aria-hidden="true" />
                    {tag.name}
                  </Badge>
                </button>
              ) : (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="gap-1 rounded-full text-xs font-normal"
                >
                  <TagIcon className="size-3" aria-hidden="true" />
                  {tag.name}
                </Badge>
              ),
            )}
            {bookmark.tags.length > 3 && (
              <Badge
                variant="outline"
                className="rounded-full text-xs font-normal"
              >
                +{bookmark.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${bookmark.title}"?`}
        description="Archived bookmarks are deleted permanently. This cannot be undone."
        onConfirm={handleDelete}
      />
    </motion.article>
  );
}
