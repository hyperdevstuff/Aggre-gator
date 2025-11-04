import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MoreVertical, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateBookmark, useDeleteBookmark } from "@/hooks/mutations";
import type { Bookmark } from "@/types";
import { Link } from "react-router-dom";

type BookmarkCardProps = {
  bookmark: Bookmark;
  onEdit?: () => void;
};

export function BookmarkCard({ bookmark, onEdit }: BookmarkCardProps) {
  const { mutate: update } = useUpdateBookmark();
  const { mutate: deleteBookmark } = useDeleteBookmark();

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    update({ id: bookmark.id, data: { isFavorite: !bookmark.isFavorite } });
  };

  const handleDelete = () => {
    if (confirm("delete this bookmark?")) {
      deleteBookmark(bookmark.id);
    }
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "invalid url";
    }
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/bookmark/${bookmark.id}`} className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-1 hover:underline">
              {bookmark.title}
            </CardTitle>
            {bookmark.description && (
              <CardDescription className="line-clamp-2 mt-1.5">
                {bookmark.description}
              </CardDescription>
            )}
          </Link>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon-sm" onClick={toggleFavorite}>
              <Star
                className={
                  bookmark.isFavorite ? "fill-current text-yellow-500" : ""
                }
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    open link
                  </a>
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>edit</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                  delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{getDomain(bookmark.url)}</span>
          <span>•</span>
          <span>{getTimeAgo(bookmark.createdAt)}</span>
        </div>
        {bookmark.tags.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {bookmark.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
