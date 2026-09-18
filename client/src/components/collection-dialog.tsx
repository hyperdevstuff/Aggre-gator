import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useCollections } from "@/hooks/queries";
import { useCreateCollection, useUpdateCollection } from "@/hooks/use-mutations";
import type { Collection } from "@/types";
import {
  collectionParentError,
  collectionDepth,
} from "#shared/collection-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type CollectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection?: Collection;
  /** When creating from a parent's menu, preselect it. */
  parentId?: string;
};

const ICON_CHOICES = ["", "📁", "🔖", "💻", "📚", "🎯", "🎵", "✈️", "💡", "🔥"];
const COLOR_CHOICES = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

/** Stand-in for "top level" — Base UI Select treats "" as empty. */
const TOP_LEVEL = "__top__";

export function CollectionDialog({ open, onOpenChange, collection, parentId }: CollectionDialogProps) {
  const isEdit = !!collection;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit collection" : "New collection"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this collection's details."
              : "Group related bookmarks together. Collections can be nested up to 3 levels."}
          </DialogDescription>
        </DialogHeader>
        <CollectionForm collection={collection} parentId={parentId} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CollectionForm({
  collection,
  parentId,
  onDone,
}: {
  collection?: Collection;
  parentId?: string;
  onDone: () => void;
}) {
  const create = useCreateCollection();
  const update = useUpdateCollection();
  const { data: collections } = useCollections();
  const pending = create.isPending || update.isPending;
  const isEdit = !!collection;

  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [icon, setIcon] = useState(collection?.icon ?? "");
  const [color, setColor] = useState(collection?.color ?? "");
  const [selectedParent, setSelectedParent] = useState(collection?.parentId ?? parentId ?? "");
  const [error, setError] = useState<string | null>(null);

  const nodes = (collections ?? []).map((c) => ({ id: c.id, parentId: c.parentId, isSystem: c.isSystem }));
  const selectedParentError = selectedParent
    ? collectionParentError(nodes, selectedParent || null, isEdit ? collection.id : undefined)
    : undefined;

  const parentOptions = (collections ?? []).filter((candidate) =>
    !collectionParentError(nodes, candidate.id, isEdit ? collection.id : undefined),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      if (collection) {
        await update.mutateAsync({
          id: collection.id,
          data: {
            name: trimmed,
            description: description.trim() || undefined,
            icon: icon || undefined,
            color: color || undefined,
            ...(selectedParent ? { parentId: selectedParent } : { parentId: null }),
          },
        });
      } else {
        await create.mutateAsync({
          name: trimmed,
          description: description.trim() || undefined,
          icon: icon || undefined,
          color: color || undefined,
          parentId: selectedParent || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this collection.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="collection-name">Name</Label>
          <Input id="collection-name" required maxLength={100} value={name}
            onChange={(event) => setName(event.target.value)} placeholder="Design inspiration" autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="collection-desc">Description (optional)</Label>
          <Textarea id="collection-desc" rows={2} value={description}
            onChange={(event) => setDescription(event.target.value)} className="min-h-16" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="collection-parent">Parent collection</Label>
          <Select value={selectedParent || TOP_LEVEL} onValueChange={(value) => setSelectedParent(!value || value === TOP_LEVEL ? "" : value)}>
            <SelectTrigger id="collection-parent" className="w-full"
              aria-invalid={!!selectedParentError}
              aria-describedby={selectedParentError ? "collection-parent-error" : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOP_LEVEL}>{isEdit ? "(Top level)" : "(No parent — top level)"}</SelectItem>
              {parentOptions.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {"— ".repeat(Math.max(0, collectionDepth(candidate.id, nodes) - 1))}{candidate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedParentError && (
            <p id="collection-parent-error" className="text-xs text-destructive">{selectedParentError}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Icon (optional)</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Collection icon">
            {ICON_CHOICES.map((choice) => (
              <button key={choice || "none"} type="button" role="radio"
                aria-checked={icon === choice}
                aria-label={choice ? `Icon ${choice}` : "No icon"}
                onClick={() => setIcon(choice)}
                className={`size-8 rounded-md border text-base transition-transform hover:scale-105 active:scale-95 ${choice ? "" : "bg-muted"} ${icon === choice ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}>
                {choice || "∅"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Color (optional)</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Collection color">
            {COLOR_CHOICES.map((choice) => (
              <button key={choice || "none"} type="button" role="radio"
                aria-checked={color === choice}
                aria-label={choice ? `Color ${choice}` : "No color"}
                onClick={() => setColor(choice)}
                className={`size-7 rounded-full border transition-transform hover:scale-110 active:scale-95 ${choice ? "" : "bg-muted"} ${color === choice ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}
                style={choice ? { backgroundColor: choice } : undefined} />
            ))}
          </div>
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending || !name.trim() || !!selectedParentError}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isEdit ? "Save changes" : "Create collection"}
        </Button>
      </DialogFooter>
    </form>
  );
}
