import { useState, type FormEvent, type RefObject } from "react";
import { Loader2 } from "lucide-react";
import { useCreateTag, useUpdateTag } from "@/hooks/use-mutations";
import type { Bookmark } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type TagDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Bookmark["tags"][number] | { id: string; name: string; color?: string | null };
  /** Element to restore focus to on close (e.g. the chip that opened the dialog). */
  returnFocus?: RefObject<HTMLElement | null>;
};

// Color palette mirrors common tag colors; empty string means "no color".
const COLOR_CHOICES = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

export function TagDialog({ open, onOpenChange, tag, returnFocus }: TagDialogProps) {
  const isEdit = !!tag;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm"
        finalFocus={returnFocus ? () => returnFocus.current?.isConnected ? returnFocus.current : false : undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit tag" : "New tag"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Rename or recolour this tag." : "Tags help you find bookmarks across collections."}
          </DialogDescription>
        </DialogHeader>
        <TagForm tag={tag} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TagForm({ tag, onDone }: { tag?: TagDialogProps["tag"]; onDone: () => void }) {
  const create = useCreateTag();
  const update = useUpdateTag();
  const pending = create.isPending || update.isPending;
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? "");
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!tag;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      if (tag) {
        await update.mutateAsync({ id: tag.id, data: { name: trimmed, color: color || undefined } });
      } else {
        await create.mutateAsync({ name: trimmed, color: color || undefined });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this tag.");
    }
  }

  return (
    <>
        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={pending}>
          <fieldset disabled={pending} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input id="tag-name" required maxLength={50} value={name}
                onChange={(event) => setName(event.target.value)} placeholder="reading" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Color (optional)</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tag color">
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
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isEdit ? "Save changes" : "Create tag"}
            </Button>
          </DialogFooter>
        </form>
      </>
  );
}
