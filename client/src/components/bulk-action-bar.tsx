import { useState } from "react";
import { Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
  const [moveTarget, setMoveTarget] = useState("");

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
            restore
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onArchive}>
            <Archive className="h-4 w-4 mr-2" aria-hidden="true" />
            archive
          </Button>
        )}
        <NativeSelect
          aria-label="Move selection to collection"
          value={moveTarget}
          onChange={(event) => {
            setMoveTarget(event.target.value);
            if (event.target.value) {
              onMove(event.target.value === "unsorted" ? null : event.target.value);
              setMoveTarget("");
            }
          }}
        >
          <NativeSelectOption value="" disabled>
            move to…
          </NativeSelectOption>
          <NativeSelectOption value="unsorted">Unsorted</NativeSelectOption>
          {collections
            .filter((collection) => !collection.isSystem)
            .map((collection) => (
              <NativeSelectOption key={collection.id} value={collection.id}>
                {collection.name}
              </NativeSelectOption>
            ))}
        </NativeSelect>
        <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
          delete
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </fieldset>
    </div>
  );
}
