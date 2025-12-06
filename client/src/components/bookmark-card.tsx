import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Star,
  MoreVertical,
  Trash2,
  Loader2,
  Edit,
} from "lucide-react";
import { useUpdateBookmark, useDeleteBookmark } from "@/hooks/use-mutations";
import type { Bookmark } from "@/types";

type BookmarkCardProps = {
  bookmark: Bookmark;
  onEdit?: (bookmark: Bookmark) => void;
};

export function BookmarkCard({ bookmark, onEdit }: BookmarkCardProps) {
  const updateBookmark = useUpdateBookmark();
  const deleteBookmark = useDeleteBookmark();

  const toggleFavorite = () => {
    updateBookmark.mutate({
      id: bookmark.id,
      data: { isFavorite: !bookmark.isFavorite },
    });
  };

  const handleDelete = () => {
    if (confirm(`delete "${bookmark.title}"?`)) {
      deleteBookmark.mutate(bookmark.id);
    }
  };

  return (
    <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow">
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
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    open
                  </a>
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(bookmark)}>
                    <Edit className="h-4 w-4 mr-2" />
                    edit
                  </DropdownMenuItem>
                )}
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

      {/*<CardContent>
        {bookmark.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {bookmark.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {bookmark.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{bookmark.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>*/}
    </Card>
  );
}
