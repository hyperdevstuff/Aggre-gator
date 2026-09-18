import { Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Collection } from "@/types";

type BulkActionBarProps = {
  count: number;
  pending: boolean;
  collections: Collection[];
  showUnarchive?: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  onMove: (collectionId: string | null) => void;
  onDelete: () => void;
  onClear: () => void;
};

export function BulkActionBar({
  count,
  pending,
  collections,
  showUnarchive,
  onArchive,
  onUnarchive,
  onMove,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  if (count === 0) return null;

  const handleDelete = () => {
    if (confirm(`delete ${count} bookmark${count === 1 ? "" : "s"}? Archived bookmarks are deleted permanently.`)) {
      onDelete();
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-10 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur"
    >
      <span role="status" className="px-2 text-sm text-muted-foreground">
        {count} selected
      </span>
      <fieldset disabled={pending} className="contents">
        {showUnarchive ? (
          <Button type="button" variant="outline" size="sm" onClick={onUnarchive}>
            <ArchiveRestore className="h-4 w-4 mr-2" aria-hidden="true" />
            Restore
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onArchive}>
            <Archive className="h-4 w-4 mr-2" aria-hidden="true" />
            Archive
          </Button>
        )}
        <Select
          value=""
          onValueChange={(value) => onMove(value === "unsorted" ? null : value)}
        >
          <SelectTrigger size="sm" aria-label="Move selection to collection">
            <SelectValue placeholder="Move to…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unsorted">Unsorted</SelectItem>
            {collections
              .filter((collection) => !collection.isSystem)
              .map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
          Delete
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </fieldset>
    </div>
  );
}
