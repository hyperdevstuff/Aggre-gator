import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
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
} from "lucide-react";
import { useUpdateBookmark, useDeleteBookmark, useBulkArchiveBookmarks, useBulkUnarchiveBookmarks } from "@/hooks/use-mutations";
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
    if (confirm(`delete "${bookmark.title}"?`)) {
      deleteBookmark.mutate(bookmark.id);
    }
  };

  return (
    <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow">
      {onToggleSelect && (
        <div className="absolute left-2 top-2 z-10 rounded-md bg-background/90 p-1 shadow-sm">
          <Checkbox
            checked={selected ?? false}
            onCheckedChange={() => onToggleSelect(bookmark.id)}
            aria-label={`Select ${bookmark.title}`}
          />
        </div>
      )}
      {bookmark.cover && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={bookmark.cover}
            alt={bookmark.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-2">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {bookmark.title}
            </a>
          </CardTitle>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
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

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="icon" variant="ghost" className="h-8 w-8"
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
                  open
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(bookmark)}>
                    <Edit className="h-4 w-4 mr-2" />
                    edit
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
                      ? "restoring..."
                      : "archiving..."
                    : isArchived
                      ? "restore"
                      : "archive"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                  disabled={deleteBookmark.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteBookmark.isPending ? "deleting..." : "delete"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <CardDescription className="line-clamp-2">
          {bookmark.description || bookmark.domain}
        </CardDescription>
      </CardHeader>

      {bookmark.tags.length > 0 && (
        <div className="px-6 pb-4 flex gap-1 flex-wrap">
          {bookmark.tags.slice(0, 3).map((tag) =>
            onEditTag ? (
              <button
                key={tag.id}
                type="button"
                className="min-h-10 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => onEditTag(tag)}
                aria-label={`Edit tag ${tag.name}`}
                title={`Edit tag ${tag.name}`}
              >
                <Badge variant="secondary" className="text-xs hover:bg-muted">
                  {tag.name}
                </Badge>
              </button>
            ) : (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ),
          )}
          {bookmark.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{bookmark.tags.length - 3}
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
