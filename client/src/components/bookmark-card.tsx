import {
  Card,
} from "@/components/ui/card";
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
import { useUpdateBookmark, useDeleteBookmark, useBulkArchiveBookmarks, useBulkUnarchiveBookmarks } from "@/hooks/use-mutations";
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

export function BookmarkCard({ bookmark, onEdit, onEditTag, isArchived, selected, onToggleSelect }: BookmarkCardProps) {
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
    <Card className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative">
        {bookmark.cover ? (
          <img
            src={bookmark.cover}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover ring-1 ring-inset ring-black/10 dark:ring-white/10"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex aspect-video w-full items-center justify-center bg-muted"
          >
            <Link2 className="size-8 text-muted-foreground/50" />
          </div>
        )}

        {onToggleSelect && (
          <div className="absolute left-2 top-2 rounded-md bg-background/90 p-1 shadow-sm">
            <Checkbox
              checked={selected ?? false}
              onCheckedChange={() => onToggleSelect(bookmark.id)}
              aria-label={`Select ${bookmark.title}`}
            />
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="icon" variant="ghost"
                className="absolute right-2 top-2 h-8 w-8 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background/90"
                aria-label={`Actions for ${bookmark.title}`}
                data-bookmark-menu={bookmark.id} />
            }
          >
            <MoreVertical className="h-4 w-4" />
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
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(bookmark)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={handleArchive}
              disabled={archivePending}
            >
              {isArchived ? (
                <ArchiveRestore className="h-4 w-4 mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
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
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteBookmark.isPending ? "Deleting…" : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start gap-1">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate font-medium hover:underline"
          >
            {bookmark.title}
          </a>
          <Button
            size="icon"
            variant="ghost"
            className="-mr-2 -mt-1 h-8 w-8 shrink-0"
            onClick={toggleFavorite}
            aria-label={bookmark.isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={bookmark.isFavorite}
            disabled={updateBookmark.isPending}
          >
            {updateBookmark.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star
                className={`h-4 w-4 ${bookmark.isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`}
              />
            )}
          </Button>
        </div>

        <p className="truncate text-xs text-muted-foreground">{bookmark.url}</p>

        {bookmark.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Tags">
            {bookmark.tags.slice(0, 3).map((tag) => (
              onEditTag ? (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onEditTag(tag)}
                  aria-label={`Edit tag ${tag.name}`}
                  title={`Edit tag ${tag.name}`}
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Badge variant="outline" className="gap-1 rounded-full text-xs font-normal hover:bg-muted">
                    <TagIcon className="size-3" aria-hidden="true" />
                    {tag.name}
                  </Badge>
                </button>
              ) : (
                <Badge key={tag.id} variant="outline" className="gap-1 rounded-full text-xs font-normal">
                  <TagIcon className="size-3" aria-hidden="true" />
                  {tag.name}
                </Badge>
              )
            ))}
            {bookmark.tags.length > 3 && (
              <Badge variant="outline" className="rounded-full text-xs font-normal">
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
    </Card>
  );
}
